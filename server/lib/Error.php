<?php
/**
 * JSON-RPC server errors class
 */

const ERROR_PARSE_ERROR = -32700;
const ERROR_INVALID_REQUEST = -32600;
const ERROR_METHOD_NOT_FOUND = -32601;
const ERROR_INVALID_PARAMS = -32602;
const ERROR_INTERNAL_ERROR = -32603;
const ERROR_SERVER_ERROR = -32099;

const CUSTOM_SEND_ERROR_SOURCE = false;

class Error {
    public $code;
    public $message;
    public $source;
    public $time;

    public function __construct($code, $message, &$source) {
        
        if (trim($message) === '') {
            $message = 'Unknown error';
        }
        
        if (!is_object($source)) {
            $source = null;
        }
        
        $this->code = $code;
        $this->message = $message;
        
        if (CUSTOM_SEND_ERROR_SOURCE) {
            $this->source = $source;
        } else {
            $this->source = null;
        }
        
        $this->time = time();
    }
    
    public function getCode() {
        return $this->code;
    }
    
    public function getMessage() {
        return $this->message;
    }
    
    public function getSource() {
        return $this->source;
    }
    
    public function getAll() {
        $exception = new stdClass();
        $exception->code = $this->code;
        $exception->message = $this->message;
        $exception->source = $this->source;
        $exception->time = $this->time;
        return $exception;
    }
};
?>
