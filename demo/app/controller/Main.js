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
            timeout: 20000,
            scope: me,
            api: {
                getFields: function(fields) {
                    me.getForm().setValues(fields);
                },
                saveFields: function(result) {
                    Ext.device.Notification.show({
                        title: 'Perfect!',
                        message: result
                    });
                },
                error: function(err) {
                    Ext.device.Notification.show({
                        title: err.title || 'Fail!',
                        message: err.message || 'Unknown error'
                    });
                }
            }
        });
    },
    
    onSendBtnTap: function() {
        var form = this.getForm();
        
        this.jsonRPC.request({
            method: 'saveFields',
            params: form.getValues()
        });
    },
    
    onGetBtnTap: function() {
        this.jsonRPC.request({
            method: 'getFields'
        });        
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
                batchOrder: 2
            },
            {
                method: 'getFields',
                batchOrder: 1
            }
        );
    }
});