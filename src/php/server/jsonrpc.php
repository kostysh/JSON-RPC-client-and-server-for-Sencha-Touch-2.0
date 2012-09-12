<?php
/**
 * @filename jsonrpc.php
 *
 * @name JsonRpcServer initialization
 * @fileOverview JSON-RPC server (conforms to JSON-RPC 2.0 Specification)
 *
 * @author Constantine V. Smirnov kostysh(at)gmail.com
 * @date 20120730
 * @license GNU GPL v3.0
 *
 * @requires PHP 5.3
 * @requires JsonRpcServer.php
 */

require_once('lib/JsonRpcServer.php');

// Custom server API class
class Api {
    
    // Place here your constructor, connect here to DB or read files etc...
    public function __construct() {
        
    }
    
    // Server API method
    public function getFields() {
        $params = array();
        $params['field1'] = 'mimi';
        $params['field2'] = 'pipi';
        $params['field3'] = 'popo';
        return $params;
    }
    
    public function saveFields($field1, $field2, $field3) {
        if ($field2 === 'Chupacabra') {
            return 'Chupacabra detected on second field!!!';
        } else {
            return 'Hey dude! We are really got your fields: ' . 
                   'field1=[' . $field1 . ']; ' . 
                   'field2=[' . $field2 . ']; ' .
                   'field3=[' . $field3 . ']';
        }
    }
};

// Setup JSON-RPC server
$server = new jsonRPC(new Api());

// Start requests handling
$server->start();
?>
