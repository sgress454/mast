// TODO: resolve how loading will work
var Framework = Mast;
////////////////////////////////////////////////////////////////////////////

// TODO: disable debug mode
Framework.debug = true;

/**
 * You should grab templates and components with something like requirejs
 * before calling Framework.raise()
 * 
 * Usage:
 * Framework.raise([options], [cb])
 * 
 * options -> {
 *	templates: {
 *		componentName: templateHTML
 *	},
 *	components: {
 *		componentName: ComponentDefinition
 *	}
 * }

cb -> function () {}

*/
Framework.raise = function (options, cb) {

	// If only one arg is present, use options as callback if possible
	// If options are not defined, use an empty object
	if (!cb && _.isFunction(options)) {
		cb = options;
	}
	if (!_.isObject(options)) {
		options = {};
	}

	// If log is specified, use it, otherwise use the console
	if (options.log) {
		Framework.log = options.log;
	}
	else {
		Framework.log = Framework.isProduction ? function () {} : console.log;
		Framework.warn = Framework.isProduction ? function () {} : console.warn;
		Framework.error = Framework.isProduction ? function () {} : console.error;
		Framework.debug = Framework.debug ? console.debug : function () {};
	}

	// Merge specified templates and components with Framework.templates & Framework.components
	_.extend(Framework.templates, options.templates || {});
	_.extend(Framework.components, options.components || {});

	// Back up each component definition before transforming it into a live prototype
	Framework.componentDefs = _.clone(Framework.components);

	// Iterate through component definitions
	_.each(Framework.components, function (componentDef, key) {
		
		// If component id is not explicitly set, use the key
		if (!componentDef.id) componentDef.id = key;

		// Validate that the component definition doesn't have any forbidden properties
		Framework.Component.prototype._validateDefinition(componentDef);

		// TODO: Validate that the component isn't named anything naughty
		// (can't think of anything that would cause problems at the moment)

		// Search templates
		var template = _.find(Framework.templates, function (template, key) {
			return key === componentDef.id;
		});

		// If no match for component was found in templates, issue a warning
		if (!template) {
			return Framework.warn(componentDef.id + ' :: No template found for component!');
		}

		// Save reference to template in component prototype
		Framework.debug(componentDef.id + ' :: Pairing component with template...');
		componentDef.template = template;

		// Go ahead and turn the definition into a real component prototype
		var componentPrototype = Framework.Component.extend(componentDef);

		// Save prototype in global set for tracking
		Framework.components[componentDef.id] = componentPrototype;
	});


	// Wait until Framework core is ready
	Framework.ready(function () {


		// TODO: v2.5
		// ################################
		// Load any missing templates named in our components asynchronously

		// Determine dependencies by parsing HTML for regions

		// Find a flat list of all the top-level region components
		// (i.e. <region>s which are not inside other <region>s)
		// ################################


		// TODO: v2.3
		// ################################
		// For all regions, absorb implicit templates, identifying discovered regions as subcomponents

		// If no implicit template found, and either:
		// (1) no component with the same name is found, and no template with the same name is found
		// or (2) a component w/ the same name is found, but no template is specified
		// Then throw an error and ignore that region.

		// How will this work?

		// Of the stuff initially in the DOM, and starting with each top-level region,
		// descend to the leaf branches in the current tree, absorbing the implicit contents 
		// from each of its child regions, until we reach a leaf.
		// ################################


		// TODO: v2.3
		// ################################
		// Only grab top-level regions, since implicit DOM parsing is enabled 
		// ################################

		// Collect any regions with the default component set from the DOM
		var $defaultRegions = $('region[default]');
		
		// Now instantiate the appropriate default component in each
		$defaultRegions.each(function(i,el) {

			// Pull id from region
			var regionId = $(el).attr('data-id') || $(el).attr('id');

			// Build region
			var region = new Framework.Region({
				id: regionId,
				$el: $(el),
				parent: { id: '*' }
			});

			// Extract default component id
			var componentId = $(el).attr('default');
			region.append(componentId);
		});
		
		// TODO: v2.0
		// ################################
		// Do the initial routing sequence
		//
		// Look at the #fragment url and fire the global route event
		// ################################


		// TODO: v2.1
		// ################################
		// Fire the register event on all async endpoint collections/models
		//
		// This will let things like socket adapters make the initial connection
		// ################################

		// ################################
		// Trigger callback
		if (cb) cb();

	});
};