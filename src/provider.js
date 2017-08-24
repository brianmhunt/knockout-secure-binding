
// See knockout/src/binding/bindingProvider.js

function secureBindingsProvider(options) {
    var existingProvider = new ko.bindingProvider();
    options = options || {};

    // override the attribute
    this.attribute = options.attribute || "data-sbind";

    // do we bind to the ko: virtual elements
    this.noVirtualElements = options.noVirtualElements || false;

    // set globals
    this.globals = options.globals || {};

    // the binding classes -- defaults to ko bindingsHandlers
    this.bindings = options.bindings || ko.bindingHandlers;

    // Cache the result of parsing binding strings.
    // TODO
    // this.cache = {};
}

function registerBindings(newBindings) {
    ko.utils.extend(this.bindings, newBindings);
}

function nodeHasBindings(node) {
    var value;
    if (node.nodeType === node.ELEMENT_NODE) {
        return node.getAttribute(this.attribute) ||
            (ko.components && ko.components.getComponentNameForNode(node));
    } else if (node.nodeType === node.COMMENT_NODE) {
        if (this.noVirtualElements) {
            return false;
        }
        value = ("" + node.nodeValue || node.text).trim();
        // See also: knockout/src/virtualElements.js
        return value.indexOf("ko ") === 0;
    }
}

function getBindingsString(node) {
    switch (node.nodeType) {
        case node.ELEMENT_NODE:
            return node.getAttribute(this.attribute);
        case node.COMMENT_NODE:
            return _virtualNodeBindingValue(node);
        default:
            return null;
    }
}

// This mirrors ko's native getComponentParamsFromCustomElement
function nodeParamsToObject(node, parser) {
    var accessors = parser.parse(node.getAttribute('params'));
    if (!accessors || Object.keys(accessors).length === 0) {
        return {$raw: {}};
    }
    var rawParamComputedValues = _object_map(accessors,
        function(paramValue, paramName) {
            return ko.computed(paramValue, null,
                { disposeWhenNodeIsRemoved: node }
            );
        }
    );
    var params = _object_map(rawParamComputedValues,
        function(paramValueComputed, paramName) {
            var paramValue = paramValueComputed.peek();
            if (!paramValueComputed.isActive()) {
                return paramValue;
            } else {
                return ko.computed({
                    read: function() {
                        return ko.utils.unwrapObservable(paramValueComputed());
                    },
                    write: ko.isWriteableObservable(paramValue) && function(value) {
                        paramValueComputed()(value);
                    },
                    disposeWhenNodeIsRemoved: node
                });
            }
        }
    );
    if (!params.hasOwnProperty('$raw')) {
        params.$raw = rawParamComputedValues;
    }
    return params;
}

function getBindings(node, context) {
    var bindings = {},
        component_name,
        parser = new Parser(node, context, this.globals),
        sbind_string = this.getBindingsString(node);

    if (node.nodeType === node.ELEMENT_NODE && ko.components) {
        component_name = ko.components.getComponentNameForNode(node);
    }

    if (sbind_string) {
        bindings = parser.parse(sbind_string || '');
    }

    // emulate ko.components.addBindingsForCustomElement(bindings, node,
    //     context, true);
    if (component_name) {
        if (bindings.component) {
            throw new Error("Cannot use a component binding on custom elements");
        }
        var componentBindingValue = {
            'name': component_name,
            'params': nodeParamsToObject(node, parser),
        };
        bindings.component =  function() { return componentBindingValue; };
    }

    return bindings;
}

ko.utils.objectForEach = function (obj, action) {
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            action(prop, obj[prop]);
        }
    }
};

ko.expressionRewriting._twoWayBindings = {};
ko.expressionRewriting._twoWayBindings['checked'] = true;
ko.expressionRewriting._twoWayBindings['hasfocus'] = true;
ko.expressionRewriting._twoWayBindings['hasFocus'] = true;
ko.expressionRewriting._twoWayBindings['selectedOptions'] = true;
ko.expressionRewriting._twoWayBindings['textInput'] = true;
ko.expressionRewriting._twoWayBindings['value'] = true;

ko.utils.extend(secureBindingsProvider.prototype, {
    registerBindings: registerBindings,
    nodeHasBindings: nodeHasBindings,
    getBindings: getBindings,
    getBindingsString: getBindingsString,
    nodeParamsToObject: nodeParamsToObject,
    Parser: Parser
});