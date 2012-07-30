<?php
/**
 * @filename Error.php
 *
 * @name Request class
 * @fileOverview JSON-RPC server request class definition
 *
 * @author Constantine V. Smirnov kostysh(at)gmail.com
 * @date 20120730
 * @version 2.0
 * @license GNU GPL v3.0
 *
 * @requires PHP 5.3
 * @requires Error.php
 */

require_once('Error.php');// Exception class

class Request {
    public $error;    
    public $raw;
    public $request;
    public $batch;
    public $requests;
    public $method;
    public $params;
    public $id;

    public function __construct() {
        $this->error = null;
        $this->batch = false;
        $this->raw = null;
        $this->request = null;        
        $this->method = 'undefined';
        $this->params = null;
        $this->id = null;
    }
    
    public function isEmpty() {
        if ($this->raw === null || $this->raw === '') {
            return true;
        } else {
            return false;
        }
    }
    
    public function isBatch() {
        return $this->batch;
    }
    
    public function isNotify() {
        if ($this->id === null) {
            return true;
        } else {
            return false;
        }
    }
    
    public function hasException() {
        if (get_class($this->error) === 'Error') {
            return true;
        } else {
            return false;
        }
    }
    
    public function getError() {
        if (get_class($this->error) === 'Error') {
            return $this->error->getAll();
        } else {
            return null;
        }
    }
    
    public function valid() {
        // error code/message already set
        if ($this->hasException()) {
            return false;
        }

        // missing jsonrpc or method
        if (!$this->request->jsonrpc || !$this->request->method) {
            $this->error = new Error(ERROR_INVALID_REQUEST, 
                                     'Invalid Request', $this);
            return false;
        }

        // reserved method prefix
        if (substr($this->request->method, 0, 4) == 'rpc.') {
            $this->error = new Error(ERROR_RESERVED_PREFIX, 
                                     "Illegal method name. ".
                                     "Method cannot start with 'rpc.'", 
                                     $this);
            return false;
        }

        // illegal method name
        if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $this->request->method)) {
            $this->error = new Error(ERROR_INVALID_REQUEST, 
                                     'Invalid Request', $this);
            return false;
        }

        // mismatched json-rpc version
        if ($this->request->jsonrpc != "2.0") {
            $this->error = new Error(ERROR_MISMATCHED_VERSION, 
                                     "Server JSON-RPC version mismatch.".
                                     " Expected '2.0'", $this);
            return false;
        }

        // valid request
        return true;
    }
    
    public function getMethod() {
        return $this->method;
    }
    
    public function getParams() {
        return $this->params;
    }
    
    public function getId() {
        return $this->id;
    }

    public function parse($jsonInput) {
        $this->raw = trim($jsonInput);
        
        // Check for request is empty or null
        if ($this->isEmpty()) {
            $this->error = new Error(ERROR_INVALID_REQUEST, 
                                     'Invalid Request', $this);
            return;
        }
        
        // Try to decode raw json
        $this->request = json_decode($this->raw);

        if ($this->request === null) {
            $this->error = new Error(ERROR_PARSE_ERROR, 
                                     'Request parse error', $this);
            return;
        }
        
        // Check for batch request
        if (is_array($this->request)) {
            
            //Check for emprty batch
            if (count($this->request) == 0) {
                $this->error = new Error(ERROR_INVALID_REQUEST, 
                                         'Invalid Request. Empty batch', $this);
                return;
            }
            
            $this->batch = true;
            
            // Build batch requests collection
            $this->requests = array();
            foreach ($this->request as $request) {
                $subRequest = new Request();
                
                if (is_object($request)) {
                    $this->requests[] = $subRequest->parse(json_encode($request));                    
                } else {
                    $this->requests[] = $subRequest->parse('');
                }
            }
            
        } else {
            
            if ($this->valid()) {
                
                // Setup configuration for validated request
                $this->method = $this->request->method;
                $this->params = $this->request->params;
                $this->id = $this->request->id;
            }
        }
        
        return $this;
    }
};
?>
