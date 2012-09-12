JSON-RPC-client-and-server-for-Sencha-Touch-2.0
===============================================

This components you can use for build communication between Sencha Touch 2.0 
application and server via JSON-RPC (spec. 2.0) or XML-RPC protocol.  

Author: Constantine V. Smirnov, kostysh(at)gmail.com, http://mindsaur.com    
License: GNU GPL v3.0    
Current version: 1.0    
ST2 version: 2.1.0 Beta1    
ST2 SDK Tools: 2.0.0 Beta 3  

Requires:
=========
- Sencha Touch 2.0
- PHP 5.3 (for server)

Versions:
=========
- 2.1Beta New features, new API config, bug fixes, XML-RPC support
- 2.0.1 Bug fixes  
- 2.0: New namespace, refactored code, bug fixes, GPL license, demo app
- 1.0: Initial release  

Features:
=========
- Conforms to JSON-RPC 2.0 Specification
- XML-RPC
- Mapping of remote API to local methods
- Single and batch requests
- By-position and by-name parameters structure
- Simple setup and usage  

Client usage:
=============

- Place src/ux to your app folder;
- Place src/php to your server;
- Configure custom path for custom components:

<!-- language: lang-js -->
            
    Ext.Loader.setPath({
        'Ext.ux': '../src/ux'
    });

- Initialisation of jsonRPC client

<!-- language: lang-js -->
            
    var jsonRPC = Ext.create('Ext.ux.data.Jsonrpc', {
        url: 'http://path-to-your-server/rpc',
        protocol: 'JSON-RPC',// or XML-RPC
        timeout: 20000,
        scope: me,
        
        // Remote API definition
        api: [
            {
                name: 'getFields',
                params: null // or simply do not define
            },
            {
                name: 'saveFields',
                model: 'Jsonrpc.model.SaveFields'// Ext.data.Model config 
            }
        ],

        // Hooks - these callbacks will be called before regular callbacks
        // you can manipulate result value inside
        hooks: {
            getFields: function(result) {

                // <debug>
                if (Ext.isObject(result)) {
                    console.log('Server response: ', result);
                }
                // </debug>

                return result;
            },
            saveFields: function(result) {

                // <debug>
                console.log('Server response: ', result);
                // </debug>

                return result;
            }
        },
        
        // Default exception handler
        error: function(err) {
            Ext.device.Notification.show({
                title: err.title || 'Fail!',
                message: err.message || 'Unknown error'
            });
        }
    });
    
- Single request to 'getFields' remote method

<!-- language: lang-js -->
            
    jsonRPC.getFields(function(fields) {
        me.getForm().setValues(fields);
    });
    
- Single request to 'saveFields' remote method

<!-- language: lang-js -->
            
    // @param {Object/Array/Function} Data fields (named or by-position), callback function
    jsonRPC.saveFields(values, function(result) {
        console.log(result);
    });
    
- Batch request

<!-- language: lang-js -->
            
    jsonRPC.request(
        {
            method: 'saveFields',
            params: form.getValues(),
            batchOrder: 2,
            callback: function(result) {
                console.log('Server response: ', result);
            }
        },
        {
            method: 'getFields',
            batchOrder: 1
        },
        {
            method: 'getFail',
            batchOrder: 0
        }
    );

Server usage:
=============
<!-- language: lang-php -->
            
    // Include server lib
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
    
Live demo: 
==========
http://mindsaur.com/demo/jsonrpc
