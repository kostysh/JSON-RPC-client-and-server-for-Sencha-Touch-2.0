/**
 * @filename JsonRPC.js
 *
 * @name JsonRPC
 * @fileOverview JSON-RPC client for Sencha Touch
 *
 * @author Constantine V. Smirnov kostysh(at)gmail.com
 * @date 20120329
 * @version 1.0
 * @license MIT
 *
 * @requires Sencha Touch 2.0
 * @requires Ext.mixin.Observable 
 * @requires Ext.data.Connection
 * 
 * Usage:
    
    // Initialisation of jsonRPC client
    var jsonRPC = Ext.create('Cs.client.JsonRPC', {
        url: 'http://path-to-your-server/rpc',
        timeout: 20000,
        scope: this,
        api: {
            getFields: function(result) {
                console.log(result);
            },
            saveFields: function(result) {
                console.log(result);
            },
            error: function(result) {
                console.log(result['message']);
            }
        }
    });
    
    // Single request to 'getFields' remote method
    jsonRPC.request({
        method: 'getFields'
    });
    
    // Single request to 'saveFields' remote method
    jsonRPC.request({
        method: 'saveFields',
        params: {
            field1: 'value1',
            field2: 'value2
        }
    });
    
    // Batch request
    jsonRPC.request(
        {
            method: 'getFields',
            batchOrder: 1
        },
        {
            method: 'saveFields',
            params: {
                field1: 'value1',
                field2: 'value2
            },
            batchOrder: 2
        },
        {
            method: 'getFail',
            batchOrder: 0
        }
    );
  
 */

/**
 * @event exception
 * Fires whenever runtime callback error
 * @param {object} err Error object
 */

/**
    Request configuration
    ...
    {
        method: 'remoteMethodName',
        params: { // Parameters to be passed to the remote method
            param1: 'value1',
            param2: 'value2
        },
        scope: this, // Scope for callback (optional)
        batchOrder: 1 // for batch requests only
    }
 
 */

Ext.define('Cs.client.JsonRPC', {
    mixins: {
        observable: 'Ext.mixin.Observable'
    },
    
    requires: [
        'Ext.data.Connection'
    ],
    
    /**
     * @cfg {object} connection {@link Ext.data.Connection} instance
     */
    connection: null,
    
    /**
     * @cfg {object} requests Collection of live requests
     */
    requests: {},
    
    config: {
        /**
         * JsonRPC configuration
         * @cfg {string} url URL to JSON-RPC server
         * @cfg {object} api PRC callbacks
         * @cfg {integer} timeout Timeout before connection abort (in milliseconds)
         * @cfg {object} scope Default scope for RPC callbacks
         */
        
        url: '',
        api: null,
        timeout: 30000,
        scope: null
    },
    
    constructor: function(config) {
        var self = this;
        self.initConfig(config);
        
        // Build connection instance
        self.connection = Ext.create('Ext.data.Connection', {
            autoAbort : false
        });
        
        // Setup exception event
        self.on({
            scope: self,
            exception: function(err) {
                var api = self.getApi();
                if (typeof api['error'] !== 'undefined') {
                    api['error'].apply(self, [{
                        'title': 'jsonRPC client exception',
                        'message': err.message
                    }]);
                }
            }
        });
        
        // Setup connection exception handler
        self.connection.on({
            scope: self,
            requestexception: function(conn, response, options, eOpts) {
                self.fireEvent('exception', {
                    message: 'Connection exception',
                    response: response,
                    options: options,
                    eOpts: eOpts
                });
            }
        });
    },
    
    applyApi: function(api) {
        if (!Ext.isObject(api)) {
            Ext.Logger.error('Wrong api configuration object');
            return;
        }
        
        return Ext.apply({
            
            // Default error callback. Must be overwritten by custom callback
            error: function(err) {
                console.log('jsonRPC error:', err.message);
            }
        }, api);
    },
    
    applyScope: function(scope) {
        if (!Ext.isObject(scope)) {
            scope = this;
        }
        
        return scope;
    },
    
    //UUID Conform to RFC-4122
    getUUID: function() {
        var s = [], itoh = '0123456789ABCDEF';
 
        for (var i = 0; i <36; i++) {
            s[i] = Math.floor(Math.random()*0x10);
        }
 
        s[14] = 4;
        s[19] = (s[19] & 0x3) | 0x8;
 
        for (var i = 0; i <36; i++) {
            s[i] = itoh[s[i]];
        } 
        
        s[8] = s[13] = s[18] = s[23] = '-';
 
        return s.join('');
    },
    
    registerId: function(id, config) {
        this.requests[id] = config;
    },
    
    removeId: function(id) {
        if (typeof this.requests[id] !== 'undefined') {
            delete this.requests[id];
        }
    },
    
    getRegistered: function(id) {
        if (typeof this.requests[id] !== 'undefined') {
            return this.requests[id];
        } else {
            return null;
        }
    },
    
    buildRequest: function(config) {
        var uuid;
        
        config.scope = config.scope || this.getScope();
        
        if (typeof config.id !== 'undefined' && 
            config.id === null) {
            uuid = null;//For notice request (without response)
        } else {
            uuid = this.getUUID();
            this.registerId(uuid, config);
        }
        
        return Ext.encode({
            jsonrpc: '2.0',
            method: config.method,
            params: config.params,
            id: uuid
        });
    },
    
    processResult: function(result) {
        var api = this.getApi();
        var registered = this.getRegistered(result.id);
        
        if (registered !== null) {
            
            if (typeof result.error !== 'undefined') {
                
                // We got error mesage from server
                api['error'].apply(registered.scope|| this.getScope(), 
                                   [result.error]);
            } else {
                
                if (typeof api[registered.method] !== 'undefined') {
                    
                    // Work with non-empty results only
                    if (typeof result.result !== 'undefined') {
                        api[registered.method].apply(registered.scope || 
                                                     this.getScope(), 
                                                     [result.result]);
                    }                            
                } else {
                    var message = 'Local jsonRPC api callback "' + 
                                  registered.method + '" not defined!';
                    Ext.Logger.warn(message);
                    this.fireEvent('exception', {message: message});
                }
            }
            
            this.removeId(result.id);
        } else {
            var message = 'Request with id=' + result.id + ' not registered!';
            Ext.Logger.warn(message);
            this.fireEvent('exception', {message: message});
        }
    },
    
    /**
     * Sends an JSON-RPC request to a remote server
     * @cfg {object} config Single or multiple requests configs
     */    
    request: function(config) {
        var self = this;
        var requests = [], batchPrefix = '', batchPostfix = '';
        
        // Check for batch configuration
        if (arguments.length > 1) {
            
            // Prepare array for batch requests
            for (var i=0; i < arguments.length; i++) {
                requests.push('');
            }
            
            // Build each request in batch
            for (var i in arguments) {
                if (typeof arguments[i].batchOrder !== 'undefined') {
                    
                    // Place request in batch position
                    requests[parseInt(arguments[i].batchOrder)] = this.buildRequest(arguments[i]);
                } else {
                    
                    // Insert request without batch order
                    requests.push(this.buildRequest(arguments[i]));
                }
            }
            
            // Remove all empty memebers
            for (var i in requests) {
                if (typeof requests[i] === 'undefined' || requests[i] === '') {
                    requests.splice(i, 1);
                }
            }
            
            batchPrefix = '[';
            batchPostfix = ']'
        } else {
            
            // Insert single request
            requests.push(this.buildRequest(config));
        }
        
        //Send request with Ext.data.Connection
        this.connection.request({
            synchronous: false,
            url: this.getUrl(),
            method: 'POST',
            headers: [
                'Content-Type:application/json',
                'Accept:application/json'
            ],
            timeout: this.getTimeout(),
            jsonData: batchPrefix + requests.join(',') + batchPostfix,
            callback: function() {
                try {
                    var result = Ext.decode(arguments[2].responseText);
                    
                    if (typeof result.length !== 'undefined') {
                        for (var i in result) {
                            self.processResult(result[i]);
                        }
                    } else {
                        self.processResult(result);
                    }
                } catch(err) {
                    Ext.Logger.warn(err);
                    self.fireEvent('exception', err);
                }
            }
        });
    }

});