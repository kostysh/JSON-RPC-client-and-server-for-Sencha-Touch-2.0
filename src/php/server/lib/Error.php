<?php
/**
 * @filename Error.php
 *
 * @name Server exceptions
 * @fileOverview Server exceptions class definition
 *
 * @author Constantine V. Smirnov kostysh(at)gmail.com
 * @date 20120730
 * @version 1.1
 * @license GNU GPL v3.0
 *
 * @requires PHP 5.3
 */

const CUSTOM_SEND_ERROR_SOURCE = false;

class Error {
    protected $code;
    protected $message;
    protected $source;
    protected $time;
    
    // @todo log errors
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
