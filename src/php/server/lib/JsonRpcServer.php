<?php
/**
 * @filename JsonRpcServer.php
 *
 * @name JsonRpcServer
 * @fileOverview JSON-RPC server (conforms to JSON-RPC 2.0 Specification)
 *
 * @author Constantine V. Smirnov kostysh(at)gmail.com
 * @date 20120730
 * @version 2.0
 * @license GNU GPL v3.0
 *
 * @requires PHP 5.3
 * @requires Request.php
 * @requires Response.php
 * @requires Error.php
 * 
 * Usage:
    
    require_once('JsonRpcServer.php');

    // Your custom server API
    class Api {
        public function __construct() {

        }

        public function getFields() {
            $params = array();
            $params['field1'] = 'value1';
            $params['field2'] = 'value2';
            $params['field3'] = 'value3';
            return $params;
        }

        public function saveFields($field1, $field2, $field3) {
            return 'Hey dude! We are really got your fields: ' . 
                   var_export(func_get_args(), true);
        }
    };
    
    // Setup your server and enable your custom API
    $server = new jsonRPC(new Api());
    
    // Start requests handling
    $server->start();
  
 */

require_once('Request.php');// Request class
require_once('Response.php');// Response class
require_once('Error.php');// Exception class

// Standard JSON-RPC error codes
const ERROR_PARSE_ERROR      = -32700;
const ERROR_INVALID_REQUEST  = -32600;
const ERROR_METHOD_NOT_FOUND = -32601;
const ERROR_INVALID_PARAMS   = -32602;
const ERROR_INTERNAL_ERROR   = -32603;
const ERROR_SERVER_ERROR     = -32099;

// Main class definition
class jsonRPC {
    
    protected $api;
    protected $input;
    protected $request;
    protected $response;

    public function __construct(&$api) {
        $this->api = $api;        
        $this->input = 'php://input';
        $this->request = new Request();
        $this->response = new Response();
    }
    
    public function setError(&$err, $id = null) {
        $this->response->setPart(array('error' => $err), $id);
    }

    public function sendError($err) {
        $this->setError($err, null);
        $this->response->send();
    }
    
    public function getResponse() {
        return $this->response;
    }

    public function methodExists($method) {
        return method_exists($this->api, $method);
    }
    
    public function invokeMethod($method, $params) {
        $reflection = new ReflectionMethod($this->api, $method);
        
        // Support for named parameters (convert from object to assoc array)
        if (is_object($params)) {
            $array = array();
            
            // Walk the args array to fill out the $params array
            foreach ($reflection->getParameters() as $temp_arg) {
            	$param_name = $temp_arg->name;
                $array[$param_name] = $params->$param_name;
            }
            
            // Removed the array wrapper as it was passing 
            // all the parameters as one parameter.
            $params = $array;
        }
        
        // For no params, pass in empty array
        if ($params === null) {
            $params = array();
        }
        
        // Call method from API with params
        return $reflection->invokeArgs($this->api, $params);
    }

    public function handleRequest(&$request) {
        
        // Check for batch mode
        if ($request->isBatch()) {
            foreach ($request->requests as $subRequest) {
                $this->handleRequest($subRequest);
            }
            return;
        }
        
        if ($request->hasException()) {
            $this->response->setPart(array('error' => $request->getError()), $request->getId());
        } else {
                        
            //check for method existence
            $methodName = $request->getMethod();
            if (!$this->methodExists($methodName)) {
                $error = new Error(ERROR_METHOD_NOT_FOUND, 
                                   'Method [' . $methodName .'] not found', 
                                   $request);
                $this->setError($error->getAll(), $request->getId());
                return;
            }

            //try to call method with params
            try {
                $response = $this->invokeMethod($request->getMethod(), $request->getParams());
                if (!$request->isNotify()) {
                    $request->result = $response;
                    $this->response->setPart(array('result' => $response), $request->getId());
                }                
            } catch (Exception $e) {
                $error = new Error(ERROR_SERVER_ERROR, $e->getMessage(), $request);
                $this->setError($error->getAll(), $request->getId());
            }
        }
    }

    public function start() {
        try {
            $json = file_get_contents($this->input);            
        } catch (Exception $e) {
            $message = "Unable to read request: ";
            $message .= PHP_EOL . $e->getMessage();
            $error = new Error(ERROR_SERVER_ERROR, $message, null);
            $this->sendError($error->getAll());
        }
        
        $this->request->parse($json);
        
        if ($this->request->hasException()) {
            $this->sendError($this->request->getError(), $this->request->getId());
        } else {
            $this->handleRequest($this->request);
            $this->response->send();
        }
    }
};
?>
