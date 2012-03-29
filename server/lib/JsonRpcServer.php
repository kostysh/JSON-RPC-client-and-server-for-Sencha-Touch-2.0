<?php
/**
 * @filename JsonRpcServer.php
 *
 * @name JsonRpcServer
 * @fileOverview JSON-RPC server (conforms to JSON-RPC 2.0 Specification)
 *
 * @author Constantine V. Smirnov kostysh(at)gmail.com
 * @date 20120329
 * @version 1.0
 * @license MIT
 *
 * @requires PHP 5.3
 * @requires Observable.php
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

        public function saveFields($params) {
            return count($params);
        }
    };
    
    // Setup your server
    $server = new jsonRPC(new Api());
    
    // Start requests handling
    $server->start();
  
 */

require_once('Observable.php');//Observable class
require_once('Request.php');//Request class
require_once('Response.php');//Response class
require_once('Error.php');//Exception class

class jsonRPC extends Observable {
    
    public $api;
    public $input;
    public $request;
    public $response;

    public function __construct($api) {
        $this->api = $api;
        $this->input = 'php://input';
        $this->request = new Request();
        $this->response = new Response();
        
        // Setup exception event handler
        $self = $this;
        $this->addListener('exception', function($evt, $err) use (&$self) {
            $self->getResponse()->setPart(array('error' => $err), null);
            $self->getResponse()->send();
        });
    }
    
    public function getResponse() {
        return $this->response;
    }

    public function methodExists($method) {
        return method_exists($this->api, $method);
    }
    
    public function invokeMethod($method, $params) {
        
        // For named parameters, convert from object to assoc array
        if (is_object($params)) {
            $array = array();
            foreach ($params as $key => $val) {
                $array[$key] = $val;
            }
            $params = array($array);
        }
        // For no params, pass in empty array
        if ($params === null) {
            $params = array();
        }
        $reflection = new ReflectionMethod($this->api, $method);
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
            if (!$this->methodExists($request->getMethod())) {
                $error = new Error(ERROR_METHOD_NOT_FOUND, 'Method not found', $request);
                $this->response->setPart(array('error' => $error->getAll()), $request->getId());
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
                $this->response->setPart(array('error' => $error->getAll()), $request->getId());
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
            $this->fireEvent('exception', $error->getAll());
        }
        
        $this->request->parse($json);
        
        if ($this->request->hasException()) {
            $this->fireEvent('exception', $this->request->getError());
        } else {
            $this->handleRequest($this->request);
            $this->response->send();
        }
    }
};
?>
