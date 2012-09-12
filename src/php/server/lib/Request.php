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
    public $server;
    public $error;
    public $mode;
    public $raw;
    public $request;
    public $batch;
    public $requests;
    public $method;
    public $params;
    public $id;

    public function __construct(&$server) {
        $this->server = $server;
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
        if (!$this->request->method) {
            $this->error = new Error(ERROR_INVALID_REQUEST, 
                                     'Invalid Request. ', $this);
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
        if ($this->server->mode === 'json' && 
            $this->request->jsonrpc !== "2.0") {
            
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

    public function parse($rawInput) {
        $this->raw = trim($rawInput);
        
        // Check for request is empty or null
        if ($this->isEmpty()) {
            $this->error = new Error(ERROR_INVALID_REQUEST, 
                                     'Invalid Request', $this);
            return;
        }
        
        if ($this->server->mode === 'xml') {
            
            // Try to decode raw xml
            $doc = new DOMDocument();
            $doc->loadXML($this->raw);
            
            // Validate root element existance
            if (($root = $doc->documentElement) && 
                !($root->nodeName !== 'methodCall' || $root->nodeName !== 'batch')) {
                
                $this->error = new Error(ERROR_INVALID_REQUEST, 
                                         'Invalid Request. Root not found', $this);
                return;
            }
            
            // Extract methodCall-s from request
            $methodCallElements = $doc->getElementsByTagName('methodCall');
            
            if ($methodCallElements->length === 0) {
                $this->error = new Error(ERROR_INVALID_REQUEST, 
                                         'Invalid Request. "methodCall" not defined', $this);
                return;
            }
            
            if ($methodCallElements->length === 1) {
                $methodCallElement = $methodCallElements->item(0);
                
                if (!$methodCallElement->hasChildNodes()) {
                    $this->error = new Error(ERROR_INVALID_REQUEST, 
                                             'Invalid request. Request has not any parameters', $this);
                    return;
                }
                
                $this->request = new stdClass();
                
                foreach ($methodCallElement->childNodes as $node) {
                    if ($node->nodeName && $node->nodeType === XML_ELEMENT_NODE) {
                        switch ($node->nodeName) {
                            case 'id': 
                                $this->request->id = $node->nodeValue;
                                break;
                            case 'methodName': 
                                $this->request->method = $node->nodeValue;
                                break;
                            case 'params':
                                if ($node->hasChildNodes()) {
                                    $this->request->params = array();
                                    foreach ($node->childNodes as $child) {
                                        if ($child->nodeName === 'param' && 
                                            $child->nodeType === XML_ELEMENT_NODE && 
                                            $child->firstChild && 
                                            $child->firstChild->nodeName === 'value' &&
                                            $child->firstChild->nodeType === XML_ELEMENT_NODE) {
                                            
                                            array_push($this->request->params, $this->decodeXmlRpc($child->firstChild));
                                        }
                                    }
                                }
                                break;
                        }
                    }
                }
            } else {
                $this->request = array();
                
                foreach ($methodCallElements as $methodCallElement) {
                    array_push($this->request, $methodCallElement);
                }                
            }            
        } else {
            
            // Try to decode raw json
            $this->request = json_decode($this->raw);
        }
        
        // Request should be not null
        if ($this->request === null) {
            $this->error = new Error(ERROR_PARSE_ERROR, 
                                     'Request parse error', $this);
            return;
        }
        
        // Check for batch request
        if (is_array($this->request)) {
            
            // Check for emprty batch
            if (count($this->request) == 0) {
                $this->error = new Error(ERROR_INVALID_REQUEST, 
                                         'Invalid Request. Empty batch', $this);
                return;
            }
            
            $this->batch = true;
            
            // Build batch requests collection
            $this->requests = array();
            foreach ($this->request as $request) {
                $subRequest = new Request($this->server);
                
                if ($this->server->mode === 'xml') {
                    array_push($this->requests, $subRequest->parse($doc->saveXML($request)));
                } else {
                    if (is_object($request)) {
                        array_push($this->requests, $subRequest->parse(json_encode($request)));
                    } else {
                        array_push($this->requests, $subRequest->parse(''));
                    }
                }
            }
            
        } else {

            if ($this->valid()) {
                
                // Setup configuration for validated request
                $this->method = $this->request->method;                
                
                if (isset($this->request->id)) {
                    $this->id = $this->request->id;
                }
                
                if (isset($this->request->params)) {
                    $this->params = $this->request->params;
                }
            }
        }

        return $this;
    }
    
    protected function decodeXmlRpc($valueEl) { 
        if ($valueEl->childNodes->length == 1 &&
            $valueEl->childNodes->item(0)->nodeType == XML_TEXT_NODE) {
            
            return $valueEl->childNodes->item(0)->nodeValue;
        }
        
        for ($i = 0; $i < $valueEl->childNodes->length; $i++) {
            
            if ($valueEl->childNodes->item($i)->nodeType == XML_ELEMENT_NODE) {
                $typeEl = $valueEl->childNodes->item($i);
                
                switch ($typeEl->nodeName) {
                    case 'i4':
                    case 'int':
                        #An integer is a 32-bit signed number. You can include a plus or minus at the
                        #   beginning of a string of numeric characters. Leading zeros are collapsed.
                        #   Whitespace is not permitted. Just numeric characters preceeded by a plus or minus.
                        if (!preg_match("/^[-\+]?\d+$/", $typeEl->firstChild->nodeValue)) {
                            $this->error = new Error(ERROR_INVALID_PARAMS, 
                                                     'Invalid parameter. The value provided as an integer ' . 
                                                     $typeEl->firstChild->nodeValue . ' is invalid', $this);
                            return '';
                        }
                        
                        $double = (double) $typeEl->firstChild->nodeValue;
                        $int = (int) $typeEl->firstChild->nodeValue;

                        #If the provided number is too big to fit in an INT, then it
                        #   will overflow so it must be stored as a DOUBLE
                        if (abs(floor($double) - $int) > 1) {
                            return $double;
                        } else {
                            return $int;
                        }
                            
                    case 'double':
                        #There is no representation for infinity or negative infinity or "not a number".
                        #   At this time, only decimal point notation is allowed, a plus or a minus,
                        #   followed by any number of numeric characters, followed by a period and any
                        #   number of numeric characters. Whitespace is not allowed. The range of
                        #   allowable values is implementation-dependent, is not specified.
                        if (!preg_match("/^[-\+]?\d+(\.\d+)?$/", $typeEl->firstChild->nodeValue)) {
                            $this->error = new Error(ERROR_INVALID_PARAMS, 
                                                     'Invalid parameter. The value provided as a double ' . 
                                                     $typeEl->firstChild->nodeValue . ' is invalid', $this);
                            return '';
                        }
                            
                        return (double) $typeEl->firstChild->nodeValue;
                        
                    case 'boolean':
                        if ($typeEl->firstChild->nodeValue != '0' && $typeEl->firstChild->nodeValue != '1') {
                            $this->error = new Error(ERROR_INVALID_PARAMS, 
                                                     'Invalid parameter. The value provided as a boolean ' . 
                                                     $typeEl->firstChild->nodeValue . ' is invalid', $this);
                            return '';
                        }
                        
                        return (bool) $typeEl->firstChild->nodeValue;
                        
                    case 'string':
                        if (!$typeEl->firstChild) {
                            return '';
                        }
                            
                        return (string) /* utf8_decode */($typeEl->firstChild->nodeValue);
                        
                    case 'dateTime.iso8601':
                        #try {
                        $date = new DateTime($typeEl->firstChild->nodeValue);
                        #}
                        #catch(Exception $e){
                        #	//trigger_error("XML-RPC Parse Error: The value provided as a dateTime.iso8601 '" . $typeEl->firstChild->nodeValue . "' is invalid.");
                        #}	
                        return $date;
                        
                    case 'base64':
                        return base64_decode($typeEl->firstChild->nodeValue);
                        
                    case 'nil':
                        return null;
                        
                    case 'struct':
                        #A <struct> contains <member>s and each <member> contains a <name> and a <value>.
                        $struct = array();
                        #$memberEl = $typeEl->firstChild;
                        for ($j = 0; $memberEl = $typeEl->childNodes->item($j); $j++) {
                            if ($memberEl->nodeType == 1 && $memberEl->nodeName == 'member') {
                                $name = '';
                                $valueEl = null;
                                for ($k = 0; $child = $memberEl->childNodes->item($k); $k++) {
                                    if ($child->nodeType == 1) {
                                        if ($child->nodeName == 'name') {
                                            $name = /* utf8_decode */($child->firstChild->nodeValue);
                                        } else if ($child->nodeName == 'value') {
                                            $valueEl = $child;
                                        }                                            
                                    }
                                }
                                #<struct>s can be recursive, any <value> may contain a <struct> or
                                #   any other type, including an <array>, described below.
                                if ($name && $valueEl) {
                                    $struct[$name] = $this->decodeXmlRpc($valueEl);
                                }                                    
                            }
                        }
                        return $struct;
                        
                    case 'array':
                        #An <array> contains a single <data> element, which can contain any number of <value>s.
                        $arr = array();
                        $dataEl = $typeEl->firstChild;
                        while ($dataEl && ($dataEl->nodeType != 1 || $dataEl->nodeName != 'data')) {
                            $dataEl = $dataEl->nextSibling;
                        }

                        if (!$dataEl) {
                            $this->error = new Error(ERROR_INVALID_PARAMS, 
                                                     "Invalid parameter. Expected 'data' element as sole child element of 'array'", $this);
                            return '';
                        }
                        
                        $valueEl = $dataEl->firstChild;
                        while ($valueEl) {
                            if ($valueEl->nodeType == 1) {
                                #<arrays>s can be recursive, any value may contain an <array> or
                                #   any other type, including a <struct>, described above.
                                if ($valueEl->nodeName == 'value') {
                                    array_push($arr, $this->decodeXmlRpc($valueEl));
                                } else {
                                    $this->error = new Error(ERROR_INVALID_PARAMS, 
                                                             "Invalid parameter. Illegal element child '" . 
                                                             $valueEl->nodeName . "' of an array's 'data' element", $this);
                                    return '';
                                }
                            }
                            $valueEl = $valueEl->nextSibling;
                        }
                        return $arr;
                        
                    default:
                        $this->error = new Error(ERROR_INVALID_PARAMS,
                                                 "Invalid parameter. Illegal element '" . 
                                                 $typeEl->nodeName . "' child of the 'value' element", $this);
                        return '';
                }
            }
        }
        
        return '';
    }
};
?>
