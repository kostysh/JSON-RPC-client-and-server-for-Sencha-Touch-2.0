Ext.define('Jsonrpc.controller.Main', {
    extend: 'Ext.app.Controller',
    
    requires: [
        'Ext.device.Notification'
    ],
    
    config: {
        refs: {
            main: '#mainView',
            form: '#mainForm',
            sendBtn: '#mainForm > #sendBtn',
            getBtn: '#mainForm > #getBtn',
            errBtn: '#mainForm > #errBtn',
            batchBtn: '#mainForm > #batchBtn',
            beautifulBatchBtn: '#mainForm > #beautifulBatchBtn'
        },
        
        control: {
            sendBtn: {
                tap: 'onSendBtnTap'
            },
            
            getBtn: {
                tap: 'onGetBtnTap'
            },
            
            errBtn: {
                tap: 'onErrBtnTap'
            },
            
            batchBtn: {
                tap: 'onBatchBtnTap'
            },
            
            beautifulBatchBtn: {
                tap: 'onBeautifulBatchBtnTap'
            }             
        }
    },
    
    init: function() {
        var me = this;
        
        me.myModel = Ext.define('User', {
            extend: 'Ext.data.Model',
            config: {
                fields: ['field1', 'field2', 'field3']
            }
        });
        
        me.jsonRPC = Ext.create('Ext.ux.data.Jsonrpc', {
//            url: '../src/php/server/jsonrpc.php',// Use this path for local testing
            url: 'http://mindsaur.com/demo/jsonrpc/server/jsonrpc.php',// Server demo
            protocol: 'XML-RPC',
            timeout: 20000,
            scope: me,
            api: [
                {
                    name: 'getFields',
                    params: null // or simply do not define
                },
                {
                    name: 'saveFields',
//                    model: 'Jsonrpc.model.SaveFields',
                    
                    // You can define model before of params directly here
                    params: [
                        {name: 'field1', type: 'string'},
                        {name: 'field2', type: 'string', convert: function(val) {
                            if (Ext.isEmpty(val)) {
                                return 'Chupacabra';
                            } else {
                                return val;
                            }
                        }},
                        {name: 'field3', type: 'string'}
                    ],
                    
                    validations: [
                        {type: 'presence', field: 'field1'},
                        {type: 'presence', field: 'field2'},
                        {type: 'presence', field: 'field3'}
                    ]
                }
            ],
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
            error: function(err) {
                Ext.device.Notification.show({
                    title: err.title || 'Fail!',
                    message: err.message || 'Unknown error'
                });
            }
        });
    },
    
    onSendBtnTap: function() {
        var me = this;
        var form = this.getForm();
        var values = form.getValues();
        
        // XML-RPC protocol does not support named parameters
        // so we should define a fields order for request
        Ext.applyIf(values, {
            fieldsSortOrder: ['field1', 'field2', 'field3']
        });
        
        me.jsonRPC.saveFields(values, function(result) {
            Ext.device.Notification.show({
                title: 'Server response',
                message: result
            });
        });
        
//        this.jsonRPC.request({
//            method: 'saveFields',
//            params: form.getValues()
//        });
    },
    
    onGetBtnTap: function() {
        var me = this;
        
        me.jsonRPC.getFields(function(fields) {
            me.getForm().setValues(fields);
        });
        
        
//        this.jsonRPC.request({
//            method: 'getFields'
//        });        
    },
    
    onErrBtnTap: function() {
        this.jsonRPC.request({
            method: 'getFail',
            id: null
        });        
    },
    
    onBatchBtnTap: function() {
        var form = this.getForm();
        
        this.jsonRPC.request(
            {
                method: 'saveFields',
                params: form.getValues(),
                batchOrder: 2
            },
            {
                id: null,// Notice request (without response)
                method: 'getFail',
                batchOrder: 0
            },
            {
                method: 'getFields',
                batchOrder: 1
            }
        );
    },
    
    onBeautifulBatchBtnTap: function() {
        var form = this.getForm();
        
        this.jsonRPC.request(
            {
                method: 'saveFields',
                params: form.getValues(),
                batchOrder: 2,
                callback: function() {
                    Ext.device.Notification.show({
                        title: 'Done',
                        message: 'Comments in console'
                    });
                }
            },
            {
                method: 'getFields',
                batchOrder: 1
            }
        );
    }
});