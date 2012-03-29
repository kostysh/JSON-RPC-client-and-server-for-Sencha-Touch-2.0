<?php
//Simple event dispatcher class
class Observable {
    protected $eventListeners = array();
    
    public function addListener($eventName, $scope, $eventCallback = null) {
        if (gettype($scope) != 'string' and $eventCallback == null) {
            
            //We can add listener without the scope
            $this->eventListeners[$eventName][] = $scope;
        } else {
            $this->eventListeners[$eventName][$scope] = $eventCallback;
        }
    }
    
    public function removeListener($eventName, $scope = null) {
        if ($scope) {
            
            //Remove scope listener only
            unset($this->eventListeners[$eventName][$scope]);
        } else {
            
            //Remove all listeners by name
            unset($this->eventListeners[$eventName]);
        }        
    }
    
    public function fireEvent($eventName) {
        if (!isset($this->eventListeners[$eventName])) {
            return false;
        }
        
        $args = array_slice(func_get_args(), 1);
        
        if (count($args) > 0) {
            $args = $args[0];
        } else {
            $args = array();
        }
        
        foreach ($this->eventListeners[$eventName] as $scope => $callback) {
            $eventObject = new stdClass();
            $eventObject->scope = $scope;
            $eventObject->time = time();
            call_user_func_array($callback, array($eventObject, $args));
        }

        return true;
    }
};
?>
