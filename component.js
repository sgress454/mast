// jQuery plugin to find the closet descendant

$.fn.closest_descendant = function(filter) {
	var $found = $(),
	$currentSet = this; // Current place
	while ($currentSet.length) {
		$found = $currentSet.filter(filter);
		if ($found.length) break;  // At least one match: break loop
		// Get all children of the current set
		$currentSet = $currentSet.children();
	}
	return $found.first(); // Return first match of the collection
}    
		
// Components are the smallest unit of event handling and logic
// Components may contain sub-components, but (as of may 12th 2012),
// they are responsible for calling render on those elements
Mast.Component = 
{
	// Custom event bindings for specific model attributes
	bindings: {},

	/**
         * attributes: properties to be added directly to the component
         *              i.e. accessible from component as:
         *                  this.someThing
         *                  this.someThingElse
         *                  
         * modelAttributes: properties to be added directly to the component's Model
         *              i.e. accessible from component as:
         *                  this.get('someThing')
         *                  this.get('someThingElse')
         *                  
         * dontRender: whether or not to render this component when it is instantiated
         *              default: false
         */
	initialize: function(attributes,modelAttributes,dontRender){
		// Bind context
		_.bindAll(this);
			
		_.extend(this,attributes);
		
		// Parse special notation in events hash
		_.each(this.events,function(handler,name) {
			var splitName = name.split(/\s+/g);
			if (splitName.length > 1 && splitName[1].substr(0,1) == '>') {
				
				// This is a closest_descendant event
				// so generate new name of event
				var newName = name.replace(/(\S+\s+)>/g, "$1");
				delete this.events[name];
				var newHandler = function (e) {
					// Stop event from propagating up to parent components
					e.stopImmediatePropagation();
					if (_.isString(handler)) {
						this[handler](e);
					}
					else {
						_.bind(handler,this)(e);
					}
					return false;
				}
				_.bind(newHandler,this);
				this.events[newName] = newHandler;
			}
		},this);
		
		
		// Build pattern	
		if (!this.pattern) {
			if (!this.template) {
				throw new Error ("No pattern or template selector specified for component!");
			}
			else {
				this.pattern = new Mast.Pattern({
					template: this.template,
					model: this.model ? this.model : new Mast.Model
				});
			}
		}
		else {
			if (this.template || this.model) {
				debug.warn ('A template selector and/or model was specified '+
					' even though a pattern was also specified!! \n'+
					'Ignoring extra attributes and using the specified pattern...');
			}
		}
				
		// If this belongs to another component, disable autorender
		if (this.parent) {
			this.autorender = false;
		}
				
		// Maintain dictionary of subcomponents
		this.children = {};
			
		// Extend model with properties specified
		var me = this;
		_.each(modelAttributes,function(val,key){
			me.pattern.set(key,val);
		});
			
		// Watch for changes to pattern
		this.pattern.on('change',this.render);
				
		// Register any subcomponents
		_.each(this.subcomponents,function(properties,key) {
			this.registerSubcomponent(properties,key);
		},this);
				
		// Trigger init event
		_.result(this,'init');
				
		// Watch for and announce statechange events
		this.on('afterRender',this.afterRender);
		this.on('beforeRender',this.beforeRender);
				
		// Autorender is on by default
		// Default render type is "append", but you can also specify "replaceOutlet""
		if (!dontRender && this.autorender!==false) {
			if (this.replaceOutlet) {
				this.replace()
			}
			else {
				this.append();
			}
		}
				
		// Listen for when the socket is live
		// (unless it's already live)
		if (Mast.Socket) {
			
			if (!Mast.Socket.connected) {
				Mast.Socket.off('connect', this.afterConnect);
				Mast.Socket.on('connect', this.afterConnect);
			}
			else {
				Mast.Socket.off('connect', this.afterConnect);
				this.afterConnect();
			}
		}
	},
		
	// Append the pattern to the outlet
	append: function (outlet) {
		var $outlet = this._verifyOutlet(outlet,
			this.parent && this.parent.$el);
			
		this.render();
		$outlet.append && $outlet.append(this.$el);
			
		return this;
	},
		
	// Replace the outlet with the rendered pattern
	replace: function (outlet) {
		var $outlet = this._verifyOutlet(outlet);
				
		this.setElement($outlet);
		this.render();
		return this;
	},
		
	// Render the pattern in-place
	render: function (silent,changes) {
		var self = this;
		this.trigger('beforeRender');
		
		
		var allCustomChanges = changes && _.all(changes,function(v,attrName) {
			return (self.bindings[attrName]);
		});
		
		// If not all of the changed attributes were accounted for, 
		// go ahead and trigger a complete rerender
		if (!allCustomChanges) {
			var $element = this.generate();
			this.$el.replaceWith($element);
			this.setElement($element);

			this.renderSubcomponents();
		}
		
		// Check bindings hash for custom render event
		// Perform custom render for this attr if it exists
//		changes && _.each(changes,function(v,attrName) {
//			self.bindings[attrName] && (_.bind(self.bindings[attrName],self))(self.get(attrName));
//		});
		_.each(self.bindings,function(v,attrName) {
			(_.bind(self.bindings[attrName],self))(self.get(attrName));
		});
			
		_.defer(function() {
			if (!silent) {
				self.trigger('afterRender');
			}
		});

		
		return this;
	},
	
	renderSubcomponents: function () {
		// If any subcomponents exist, 
		_.each(this.children,function(subcomponent,key) {
			
			// append them to the appropriate outlet
			_.defer(function() {
				subcomponent.append();
			})
			
		},this);
	},
			
	// Use pattern to generate a DOM element
	generate: function (data) {
		data = this._normalizeData(data);
		return $(this.pattern.generate(data));
	},
			
	// Register a new subcomponent from a definition
	registerSubcomponent: function(options,key) {
		var Subcomponent;
				
		if (!options.component) {
			throw new Error("Cannot register subcomponent because 'component' was not defined!");
		}
		else if ( typeof Mast.components[options.component] == "undefined" ) {
			throw new Error("Cannot register subcomponent because specified component, '"+options.component+"', does not exist!");
		}
		else {
			Subcomponent = options.component;
		}
		
		// Provision prototype for subcomponent
		Subcomponent = this._provisionPrototype(Subcomponent,Mast.components,Mast.Component)
				
		// Build property list with specified pieces
		var plist = {
			parent: this,
			outlet: options.outlet
		};
		// Remove stuff from definition that shouldn't be transfered as params
		_.each(options,function(val,key) {
			if (key!='component' && key!='outlet') {
				plist[key]=val;
			}
		});
		
		
		// Instantiate subcomponent, but don't append/render it yet
		var subcomponent = new Subcomponent(plist,plist);
		this.children[key] = subcomponent;
	},
			
	// Free the memory for this component and remove it from the DOM
	destroy: function () {
		// Remove models from modelCache
		this.pattern.model.cid && delete Mast.modelCache[this.pattern.model.cid];
		this.collection && this.collection.cid && delete Mast.modelCache[this.collection.cid];
			
		this.undelegateEvents();
		this.$el.remove();
	},
			
	// Set pattern's template selector
	setTemplate: function (selector,options){
		options = _.defaults(options || {}, {
			render: true
		});
		
		// If a render function is specified, use that
		if (_.isFunction(options.render)) {
			// call custom render function with current and new elements (in the proper scope)
			_.bind(options.render,this);
			options.render(this.$el,this.generate());
		}
		// Otherwise just do a basic render by triggering the default behavior
		else {
			this.pattern.setTemplate(selector,options);
		}
		return this.$el;
	},
			
	// Set pattern's model attribute
	set: function (attribute,value,options){
		var outcome;
		options = _.defaults(options || {}, {
			render: true
		});
		
		// If a render function is specified, use that
		if (_.isFunction(options.render)) {
			// call custom render function with current and new elements (in the proper scope)
			this.pattern.set(attribute,value,_.extend(options,{
				silent:true
			}));
			_.bind(options.render,this);
			options.render(this.$el,this.generate());
			outcome = true;
		}
		// Otherwise just do a basic render by triggering the default behavior
		else {
			outcome = this.pattern.set(attribute,value,options);		
		}
		return outcome;
	},
	
	save: function () {
		this.pattern.model.save(null,{
			silent:true
		});
	},
	
	get: function(attribute) {
		return this.pattern.get(attribute);
	},
			
	beforeRender: function(){
	// stub
	},
	
	afterRender: function(){
	// stub
	},
			
	afterConnect: function(){
	// stub
	},
			
	// Default HTML to display if table is empty and no emptytemplate
	// is specified
	emptyHTML: "<span>There are no children available.</span>",
			
			
			
	// Determine the proper outlet selector and ensure that it is valid
	_verifyOutlet: function (outlet,context) {
		
		// If a parent component exists, render into that by default
		outlet = outlet || this.outlet || (this.parent && this.parent.$el);
		
		if (!outlet && !this.parent) {
			throw new Error("No outlet selector specified to render into!");
			return false;
		}
				
		var $outlet;
		if (_.isString(outlet)) {
			$outlet = (context && context.closest_descendant(outlet)) || $(outlet);
		}
		else {
			$outlet = outlet;
		}
		
		if ($outlet.length != 1) {
			
			//			debug.debug($outlet,outlet,this.parent.$el);
			debug.warn(
				(($outlet.length > 1)?"More than one ":"No ")+
				(($outlet.length > 1)?"element exists ":"elements exist ")+
				(context?"in this template context ("+context+ ")":"") +
				"for the specified "+
				(context?"child ":"") +
				"outlet selector! ('"+outlet+"')");
			return false;
		}

			
		return $outlet;
	},
	
	// Accept direct reference to prototype or a string and return a prototype
	_provisionPrototype: function (identity, identitySet, identityPrototype) {
		
		if (identity && _.isObject(identity) && _.isFunction(identity)) {
			return identity;
		}
		else if (_.isString(identity)) {
			// A string component name
			if (!(identity = (identitySet[identity]))) {
				throw new Error("No identity with that name ("+identity+") exists!");
			}
		}
		else {
			throw new Error ("Invalid identity provided: " + identity);
		}
		return identity;
	},
			
	// Used for debugging
	_test: function() {
		debug.debug("TEST FUNCTION FIRED!",arguments,this);
	}
}