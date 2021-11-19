
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function tick() {
        schedule_update();
        return resolved_promise;
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.44.2' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /**
     * @typedef {Object} WrappedComponent Object returned by the `wrap` method
     * @property {SvelteComponent} component - Component to load (this is always asynchronous)
     * @property {RoutePrecondition[]} [conditions] - Route pre-conditions to validate
     * @property {Object} [props] - Optional dictionary of static props
     * @property {Object} [userData] - Optional user data dictionary
     * @property {bool} _sveltesparouter - Internal flag; always set to true
     */

    /**
     * @callback AsyncSvelteComponent
     * @returns {Promise<SvelteComponent>} Returns a Promise that resolves with a Svelte component
     */

    /**
     * @callback RoutePrecondition
     * @param {RouteDetail} detail - Route detail object
     * @returns {boolean|Promise<boolean>} If the callback returns a false-y value, it's interpreted as the precondition failed, so it aborts loading the component (and won't process other pre-condition callbacks)
     */

    /**
     * @typedef {Object} WrapOptions Options object for the call to `wrap`
     * @property {SvelteComponent} [component] - Svelte component to load (this is incompatible with `asyncComponent`)
     * @property {AsyncSvelteComponent} [asyncComponent] - Function that returns a Promise that fulfills with a Svelte component (e.g. `{asyncComponent: () => import('Foo.svelte')}`)
     * @property {SvelteComponent} [loadingComponent] - Svelte component to be displayed while the async route is loading (as a placeholder); when unset or false-y, no component is shown while component
     * @property {object} [loadingParams] - Optional dictionary passed to the `loadingComponent` component as params (for an exported prop called `params`)
     * @property {object} [userData] - Optional object that will be passed to events such as `routeLoading`, `routeLoaded`, `conditionsFailed`
     * @property {object} [props] - Optional key-value dictionary of static props that will be passed to the component. The props are expanded with {...props}, so the key in the dictionary becomes the name of the prop.
     * @property {RoutePrecondition[]|RoutePrecondition} [conditions] - Route pre-conditions to add, which will be executed in order
     */

    /**
     * Wraps a component to enable multiple capabilities:
     * 1. Using dynamically-imported component, with (e.g. `{asyncComponent: () => import('Foo.svelte')}`), which also allows bundlers to do code-splitting.
     * 2. Adding route pre-conditions (e.g. `{conditions: [...]}`)
     * 3. Adding static props that are passed to the component
     * 4. Adding custom userData, which is passed to route events (e.g. route loaded events) or to route pre-conditions (e.g. `{userData: {foo: 'bar}}`)
     * 
     * @param {WrapOptions} args - Arguments object
     * @returns {WrappedComponent} Wrapped component
     */
    function wrap$1(args) {
        if (!args) {
            throw Error('Parameter args is required')
        }

        // We need to have one and only one of component and asyncComponent
        // This does a "XNOR"
        if (!args.component == !args.asyncComponent) {
            throw Error('One and only one of component and asyncComponent is required')
        }

        // If the component is not async, wrap it into a function returning a Promise
        if (args.component) {
            args.asyncComponent = () => Promise.resolve(args.component);
        }

        // Parameter asyncComponent and each item of conditions must be functions
        if (typeof args.asyncComponent != 'function') {
            throw Error('Parameter asyncComponent must be a function')
        }
        if (args.conditions) {
            // Ensure it's an array
            if (!Array.isArray(args.conditions)) {
                args.conditions = [args.conditions];
            }
            for (let i = 0; i < args.conditions.length; i++) {
                if (!args.conditions[i] || typeof args.conditions[i] != 'function') {
                    throw Error('Invalid parameter conditions[' + i + ']')
                }
            }
        }

        // Check if we have a placeholder component
        if (args.loadingComponent) {
            args.asyncComponent.loading = args.loadingComponent;
            args.asyncComponent.loadingParams = args.loadingParams || undefined;
        }

        // Returns an object that contains all the functions to execute too
        // The _sveltesparouter flag is to confirm the object was created by this router
        const obj = {
            component: args.asyncComponent,
            userData: args.userData,
            conditions: (args.conditions && args.conditions.length) ? args.conditions : undefined,
            props: (args.props && Object.keys(args.props).length) ? args.props : {},
            _sveltesparouter: true
        };

        return obj
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    function parse(str, loose) {
    	if (str instanceof RegExp) return { keys:false, pattern:str };
    	var c, o, tmp, ext, keys=[], pattern='', arr = str.split('/');
    	arr[0] || arr.shift();

    	while (tmp = arr.shift()) {
    		c = tmp[0];
    		if (c === '*') {
    			keys.push('wild');
    			pattern += '/(.*)';
    		} else if (c === ':') {
    			o = tmp.indexOf('?', 1);
    			ext = tmp.indexOf('.', 1);
    			keys.push( tmp.substring(1, !!~o ? o : !!~ext ? ext : tmp.length) );
    			pattern += !!~o && !~ext ? '(?:/([^/]+?))?' : '/([^/]+?)';
    			if (!!~ext) pattern += (!!~o ? '?' : '') + '\\' + tmp.substring(ext);
    		} else {
    			pattern += '/' + tmp;
    		}
    	}

    	return {
    		keys: keys,
    		pattern: new RegExp('^' + pattern + (loose ? '(?=$|\/)' : '\/?$'), 'i')
    	};
    }

    /* node_modules/svelte-spa-router/Router.svelte generated by Svelte v3.44.2 */

    const { Error: Error_1, Object: Object_1, console: console_1 } = globals;

    // (251:0) {:else}
    function create_else_block(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [/*props*/ ctx[2]];
    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    		switch_instance.$on("routeEvent", /*routeEvent_handler_1*/ ctx[7]);
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*props*/ 4)
    			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*props*/ ctx[2])])
    			: {};

    			if (switch_value !== (switch_value = /*component*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					switch_instance.$on("routeEvent", /*routeEvent_handler_1*/ ctx[7]);
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(251:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (244:0) {#if componentParams}
    function create_if_block(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [{ params: /*componentParams*/ ctx[1] }, /*props*/ ctx[2]];
    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    		switch_instance.$on("routeEvent", /*routeEvent_handler*/ ctx[6]);
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*componentParams, props*/ 6)
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*componentParams*/ 2 && { params: /*componentParams*/ ctx[1] },
    					dirty & /*props*/ 4 && get_spread_object(/*props*/ ctx[2])
    				])
    			: {};

    			if (switch_value !== (switch_value = /*component*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					switch_instance.$on("routeEvent", /*routeEvent_handler*/ ctx[6]);
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(244:0) {#if componentParams}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*componentParams*/ ctx[1]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function wrap(component, userData, ...conditions) {
    	// Use the new wrap method and show a deprecation warning
    	// eslint-disable-next-line no-console
    	console.warn('Method `wrap` from `svelte-spa-router` is deprecated and will be removed in a future version. Please use `svelte-spa-router/wrap` instead. See http://bit.ly/svelte-spa-router-upgrading');

    	return wrap$1({ component, userData, conditions });
    }

    /**
     * @typedef {Object} Location
     * @property {string} location - Location (page/view), for example `/book`
     * @property {string} [querystring] - Querystring from the hash, as a string not parsed
     */
    /**
     * Returns the current location from the hash.
     *
     * @returns {Location} Location object
     * @private
     */
    function getLocation() {
    	const hashPosition = window.location.href.indexOf('#/');

    	let location = hashPosition > -1
    	? window.location.href.substr(hashPosition + 1)
    	: '/';

    	// Check if there's a querystring
    	const qsPosition = location.indexOf('?');

    	let querystring = '';

    	if (qsPosition > -1) {
    		querystring = location.substr(qsPosition + 1);
    		location = location.substr(0, qsPosition);
    	}

    	return { location, querystring };
    }

    const loc = readable(null, // eslint-disable-next-line prefer-arrow-callback
    function start(set) {
    	set(getLocation());

    	const update = () => {
    		set(getLocation());
    	};

    	window.addEventListener('hashchange', update, false);

    	return function stop() {
    		window.removeEventListener('hashchange', update, false);
    	};
    });

    const location = derived(loc, $loc => $loc.location);
    const querystring = derived(loc, $loc => $loc.querystring);
    const params = writable(undefined);

    async function push(location) {
    	if (!location || location.length < 1 || location.charAt(0) != '/' && location.indexOf('#/') !== 0) {
    		throw Error('Invalid parameter location');
    	}

    	// Execute this code when the current call stack is complete
    	await tick();

    	// Note: this will include scroll state in history even when restoreScrollState is false
    	history.replaceState(
    		{
    			...history.state,
    			__svelte_spa_router_scrollX: window.scrollX,
    			__svelte_spa_router_scrollY: window.scrollY
    		},
    		undefined,
    		undefined
    	);

    	window.location.hash = (location.charAt(0) == '#' ? '' : '#') + location;
    }

    async function pop() {
    	// Execute this code when the current call stack is complete
    	await tick();

    	window.history.back();
    }

    async function replace(location) {
    	if (!location || location.length < 1 || location.charAt(0) != '/' && location.indexOf('#/') !== 0) {
    		throw Error('Invalid parameter location');
    	}

    	// Execute this code when the current call stack is complete
    	await tick();

    	const dest = (location.charAt(0) == '#' ? '' : '#') + location;

    	try {
    		const newState = { ...history.state };
    		delete newState['__svelte_spa_router_scrollX'];
    		delete newState['__svelte_spa_router_scrollY'];
    		window.history.replaceState(newState, undefined, dest);
    	} catch(e) {
    		// eslint-disable-next-line no-console
    		console.warn('Caught exception while replacing the current page. If you\'re running this in the Svelte REPL, please note that the `replace` method might not work in this environment.');
    	}

    	// The method above doesn't trigger the hashchange event, so let's do that manually
    	window.dispatchEvent(new Event('hashchange'));
    }

    function link(node, opts) {
    	opts = linkOpts(opts);

    	// Only apply to <a> tags
    	if (!node || !node.tagName || node.tagName.toLowerCase() != 'a') {
    		throw Error('Action "link" can only be used with <a> tags');
    	}

    	updateLink(node, opts);

    	return {
    		update(updated) {
    			updated = linkOpts(updated);
    			updateLink(node, updated);
    		}
    	};
    }

    // Internal function used by the link function
    function updateLink(node, opts) {
    	let href = opts.href || node.getAttribute('href');

    	// Destination must start with '/' or '#/'
    	if (href && href.charAt(0) == '/') {
    		// Add # to the href attribute
    		href = '#' + href;
    	} else if (!href || href.length < 2 || href.slice(0, 2) != '#/') {
    		throw Error('Invalid value for "href" attribute: ' + href);
    	}

    	node.setAttribute('href', href);

    	node.addEventListener('click', event => {
    		// Prevent default anchor onclick behaviour
    		event.preventDefault();

    		if (!opts.disabled) {
    			scrollstateHistoryHandler(event.currentTarget.getAttribute('href'));
    		}
    	});
    }

    // Internal function that ensures the argument of the link action is always an object
    function linkOpts(val) {
    	if (val && typeof val == 'string') {
    		return { href: val };
    	} else {
    		return val || {};
    	}
    }

    /**
     * The handler attached to an anchor tag responsible for updating the
     * current history state with the current scroll state
     *
     * @param {string} href - Destination
     */
    function scrollstateHistoryHandler(href) {
    	// Setting the url (3rd arg) to href will break clicking for reasons, so don't try to do that
    	history.replaceState(
    		{
    			...history.state,
    			__svelte_spa_router_scrollX: window.scrollX,
    			__svelte_spa_router_scrollY: window.scrollY
    		},
    		undefined,
    		undefined
    	);

    	// This will force an update as desired, but this time our scroll state will be attached
    	window.location.hash = href;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Router', slots, []);
    	let { routes = {} } = $$props;
    	let { prefix = '' } = $$props;
    	let { restoreScrollState = false } = $$props;

    	/**
     * Container for a route: path, component
     */
    	class RouteItem {
    		/**
     * Initializes the object and creates a regular expression from the path, using regexparam.
     *
     * @param {string} path - Path to the route (must start with '/' or '*')
     * @param {SvelteComponent|WrappedComponent} component - Svelte component for the route, optionally wrapped
     */
    		constructor(path, component) {
    			if (!component || typeof component != 'function' && (typeof component != 'object' || component._sveltesparouter !== true)) {
    				throw Error('Invalid component object');
    			}

    			// Path must be a regular or expression, or a string starting with '/' or '*'
    			if (!path || typeof path == 'string' && (path.length < 1 || path.charAt(0) != '/' && path.charAt(0) != '*') || typeof path == 'object' && !(path instanceof RegExp)) {
    				throw Error('Invalid value for "path" argument - strings must start with / or *');
    			}

    			const { pattern, keys } = parse(path);
    			this.path = path;

    			// Check if the component is wrapped and we have conditions
    			if (typeof component == 'object' && component._sveltesparouter === true) {
    				this.component = component.component;
    				this.conditions = component.conditions || [];
    				this.userData = component.userData;
    				this.props = component.props || {};
    			} else {
    				// Convert the component to a function that returns a Promise, to normalize it
    				this.component = () => Promise.resolve(component);

    				this.conditions = [];
    				this.props = {};
    			}

    			this._pattern = pattern;
    			this._keys = keys;
    		}

    		/**
     * Checks if `path` matches the current route.
     * If there's a match, will return the list of parameters from the URL (if any).
     * In case of no match, the method will return `null`.
     *
     * @param {string} path - Path to test
     * @returns {null|Object.<string, string>} List of paramters from the URL if there's a match, or `null` otherwise.
     */
    		match(path) {
    			// If there's a prefix, check if it matches the start of the path.
    			// If not, bail early, else remove it before we run the matching.
    			if (prefix) {
    				if (typeof prefix == 'string') {
    					if (path.startsWith(prefix)) {
    						path = path.substr(prefix.length) || '/';
    					} else {
    						return null;
    					}
    				} else if (prefix instanceof RegExp) {
    					const match = path.match(prefix);

    					if (match && match[0]) {
    						path = path.substr(match[0].length) || '/';
    					} else {
    						return null;
    					}
    				}
    			}

    			// Check if the pattern matches
    			const matches = this._pattern.exec(path);

    			if (matches === null) {
    				return null;
    			}

    			// If the input was a regular expression, this._keys would be false, so return matches as is
    			if (this._keys === false) {
    				return matches;
    			}

    			const out = {};
    			let i = 0;

    			while (i < this._keys.length) {
    				// In the match parameters, URL-decode all values
    				try {
    					out[this._keys[i]] = decodeURIComponent(matches[i + 1] || '') || null;
    				} catch(e) {
    					out[this._keys[i]] = null;
    				}

    				i++;
    			}

    			return out;
    		}

    		/**
     * Dictionary with route details passed to the pre-conditions functions, as well as the `routeLoading`, `routeLoaded` and `conditionsFailed` events
     * @typedef {Object} RouteDetail
     * @property {string|RegExp} route - Route matched as defined in the route definition (could be a string or a reguar expression object)
     * @property {string} location - Location path
     * @property {string} querystring - Querystring from the hash
     * @property {object} [userData] - Custom data passed by the user
     * @property {SvelteComponent} [component] - Svelte component (only in `routeLoaded` events)
     * @property {string} [name] - Name of the Svelte component (only in `routeLoaded` events)
     */
    		/**
     * Executes all conditions (if any) to control whether the route can be shown. Conditions are executed in the order they are defined, and if a condition fails, the following ones aren't executed.
     * 
     * @param {RouteDetail} detail - Route detail
     * @returns {boolean} Returns true if all the conditions succeeded
     */
    		async checkConditions(detail) {
    			for (let i = 0; i < this.conditions.length; i++) {
    				if (!await this.conditions[i](detail)) {
    					return false;
    				}
    			}

    			return true;
    		}
    	}

    	// Set up all routes
    	const routesList = [];

    	if (routes instanceof Map) {
    		// If it's a map, iterate on it right away
    		routes.forEach((route, path) => {
    			routesList.push(new RouteItem(path, route));
    		});
    	} else {
    		// We have an object, so iterate on its own properties
    		Object.keys(routes).forEach(path => {
    			routesList.push(new RouteItem(path, routes[path]));
    		});
    	}

    	// Props for the component to render
    	let component = null;

    	let componentParams = null;
    	let props = {};

    	// Event dispatcher from Svelte
    	const dispatch = createEventDispatcher();

    	// Just like dispatch, but executes on the next iteration of the event loop
    	async function dispatchNextTick(name, detail) {
    		// Execute this code when the current call stack is complete
    		await tick();

    		dispatch(name, detail);
    	}

    	// If this is set, then that means we have popped into this var the state of our last scroll position
    	let previousScrollState = null;

    	let popStateChanged = null;

    	if (restoreScrollState) {
    		popStateChanged = event => {
    			// If this event was from our history.replaceState, event.state will contain
    			// our scroll history. Otherwise, event.state will be null (like on forward
    			// navigation)
    			if (event.state && event.state.__svelte_spa_router_scrollY) {
    				previousScrollState = event.state;
    			} else {
    				previousScrollState = null;
    			}
    		};

    		// This is removed in the destroy() invocation below
    		window.addEventListener('popstate', popStateChanged);

    		afterUpdate(() => {
    			// If this exists, then this is a back navigation: restore the scroll position
    			if (previousScrollState) {
    				window.scrollTo(previousScrollState.__svelte_spa_router_scrollX, previousScrollState.__svelte_spa_router_scrollY);
    			} else {
    				// Otherwise this is a forward navigation: scroll to top
    				window.scrollTo(0, 0);
    			}
    		});
    	}

    	// Always have the latest value of loc
    	let lastLoc = null;

    	// Current object of the component loaded
    	let componentObj = null;

    	// Handle hash change events
    	// Listen to changes in the $loc store and update the page
    	// Do not use the $: syntax because it gets triggered by too many things
    	const unsubscribeLoc = loc.subscribe(async newLoc => {
    		lastLoc = newLoc;

    		// Find a route matching the location
    		let i = 0;

    		while (i < routesList.length) {
    			const match = routesList[i].match(newLoc.location);

    			if (!match) {
    				i++;
    				continue;
    			}

    			const detail = {
    				route: routesList[i].path,
    				location: newLoc.location,
    				querystring: newLoc.querystring,
    				userData: routesList[i].userData,
    				params: match && typeof match == 'object' && Object.keys(match).length
    				? match
    				: null
    			};

    			// Check if the route can be loaded - if all conditions succeed
    			if (!await routesList[i].checkConditions(detail)) {
    				// Don't display anything
    				$$invalidate(0, component = null);

    				componentObj = null;

    				// Trigger an event to notify the user, then exit
    				dispatchNextTick('conditionsFailed', detail);

    				return;
    			}

    			// Trigger an event to alert that we're loading the route
    			// We need to clone the object on every event invocation so we don't risk the object to be modified in the next tick
    			dispatchNextTick('routeLoading', Object.assign({}, detail));

    			// If there's a component to show while we're loading the route, display it
    			const obj = routesList[i].component;

    			// Do not replace the component if we're loading the same one as before, to avoid the route being unmounted and re-mounted
    			if (componentObj != obj) {
    				if (obj.loading) {
    					$$invalidate(0, component = obj.loading);
    					componentObj = obj;
    					$$invalidate(1, componentParams = obj.loadingParams);
    					$$invalidate(2, props = {});

    					// Trigger the routeLoaded event for the loading component
    					// Create a copy of detail so we don't modify the object for the dynamic route (and the dynamic route doesn't modify our object too)
    					dispatchNextTick('routeLoaded', Object.assign({}, detail, {
    						component,
    						name: component.name,
    						params: componentParams
    					}));
    				} else {
    					$$invalidate(0, component = null);
    					componentObj = null;
    				}

    				// Invoke the Promise
    				const loaded = await obj();

    				// Now that we're here, after the promise resolved, check if we still want this component, as the user might have navigated to another page in the meanwhile
    				if (newLoc != lastLoc) {
    					// Don't update the component, just exit
    					return;
    				}

    				// If there is a "default" property, which is used by async routes, then pick that
    				$$invalidate(0, component = loaded && loaded.default || loaded);

    				componentObj = obj;
    			}

    			// Set componentParams only if we have a match, to avoid a warning similar to `<Component> was created with unknown prop 'params'`
    			// Of course, this assumes that developers always add a "params" prop when they are expecting parameters
    			if (match && typeof match == 'object' && Object.keys(match).length) {
    				$$invalidate(1, componentParams = match);
    			} else {
    				$$invalidate(1, componentParams = null);
    			}

    			// Set static props, if any
    			$$invalidate(2, props = routesList[i].props);

    			// Dispatch the routeLoaded event then exit
    			// We need to clone the object on every event invocation so we don't risk the object to be modified in the next tick
    			dispatchNextTick('routeLoaded', Object.assign({}, detail, {
    				component,
    				name: component.name,
    				params: componentParams
    			})).then(() => {
    				params.set(componentParams);
    			});

    			return;
    		}

    		// If we're still here, there was no match, so show the empty component
    		$$invalidate(0, component = null);

    		componentObj = null;
    		params.set(undefined);
    	});

    	onDestroy(() => {
    		unsubscribeLoc();
    		popStateChanged && window.removeEventListener('popstate', popStateChanged);
    	});

    	const writable_props = ['routes', 'prefix', 'restoreScrollState'];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	function routeEvent_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	function routeEvent_handler_1(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ('routes' in $$props) $$invalidate(3, routes = $$props.routes);
    		if ('prefix' in $$props) $$invalidate(4, prefix = $$props.prefix);
    		if ('restoreScrollState' in $$props) $$invalidate(5, restoreScrollState = $$props.restoreScrollState);
    	};

    	$$self.$capture_state = () => ({
    		readable,
    		writable,
    		derived,
    		tick,
    		_wrap: wrap$1,
    		wrap,
    		getLocation,
    		loc,
    		location,
    		querystring,
    		params,
    		push,
    		pop,
    		replace,
    		link,
    		updateLink,
    		linkOpts,
    		scrollstateHistoryHandler,
    		onDestroy,
    		createEventDispatcher,
    		afterUpdate,
    		parse,
    		routes,
    		prefix,
    		restoreScrollState,
    		RouteItem,
    		routesList,
    		component,
    		componentParams,
    		props,
    		dispatch,
    		dispatchNextTick,
    		previousScrollState,
    		popStateChanged,
    		lastLoc,
    		componentObj,
    		unsubscribeLoc
    	});

    	$$self.$inject_state = $$props => {
    		if ('routes' in $$props) $$invalidate(3, routes = $$props.routes);
    		if ('prefix' in $$props) $$invalidate(4, prefix = $$props.prefix);
    		if ('restoreScrollState' in $$props) $$invalidate(5, restoreScrollState = $$props.restoreScrollState);
    		if ('component' in $$props) $$invalidate(0, component = $$props.component);
    		if ('componentParams' in $$props) $$invalidate(1, componentParams = $$props.componentParams);
    		if ('props' in $$props) $$invalidate(2, props = $$props.props);
    		if ('previousScrollState' in $$props) previousScrollState = $$props.previousScrollState;
    		if ('popStateChanged' in $$props) popStateChanged = $$props.popStateChanged;
    		if ('lastLoc' in $$props) lastLoc = $$props.lastLoc;
    		if ('componentObj' in $$props) componentObj = $$props.componentObj;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*restoreScrollState*/ 32) {
    			// Update history.scrollRestoration depending on restoreScrollState
    			history.scrollRestoration = restoreScrollState ? 'manual' : 'auto';
    		}
    	};

    	return [
    		component,
    		componentParams,
    		props,
    		routes,
    		prefix,
    		restoreScrollState,
    		routeEvent_handler,
    		routeEvent_handler_1
    	];
    }

    class Router extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {
    			routes: 3,
    			prefix: 4,
    			restoreScrollState: 5
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Router",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get routes() {
    		throw new Error_1("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set routes(value) {
    		throw new Error_1("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get prefix() {
    		throw new Error_1("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set prefix(value) {
    		throw new Error_1("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get restoreScrollState() {
    		throw new Error_1("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set restoreScrollState(value) {
    		throw new Error_1("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /**
     * DarkMode Typescript
     * =====================
     *
     * @contributors: Patryk Rzucidło [@ptkdev] <support@ptkdev.io> (https://ptk.dev)
     *
     * @license: MIT License
     *
     */
    let darkmode = false;
    /**
     * DarkMode Toggle
     * =====================
     * Return true or false if darkmode is enabled
     *
     * @return {boolean} darkmode - true = dark mode enabled, false = light mode enabled
     *
     */
    const darkModeToggle = () => {
        var _a, _b, _c;
        if ((_a = document.querySelector("html")) === null || _a === void 0 ? void 0 : _a.classList.contains("darkmode")) {
            darkmode = false;
        }
        else {
            darkmode = true;
        }
        (_b = document.querySelector("html")) === null || _b === void 0 ? void 0 : _b.classList.toggle("darkmode");
        (_c = document.querySelector("body")) === null || _c === void 0 ? void 0 : _c.classList.toggle("darkmode");
        window.localStorage.setItem("darkmode", darkmode ? "enabled" : "disabled");
        return darkmode;
    };
    /**
     * DarkMode Detect
     * =====================
     * Check if exist prefers-color-scheme or darkmode value from localStorage() and set dark mode
     *
     * @return {boolean} darkmode - true = dark mode enabled, false = light mode enabled
     *
     */
    const darkModeDetect = () => {
        var _a, _b, _c;
        if (window.localStorage.getItem("darkmode") === "enabled" ||
            (window.localStorage.getItem("darkmode") === undefined &&
                (window === null || window === void 0 ? void 0 : window.matchMedia("(prefers-color-scheme: dark)").matches))) {
            if (!((_a = document.querySelector("html")) === null || _a === void 0 ? void 0 : _a.classList.contains("darkmode"))) {
                (_b = document.querySelector("html")) === null || _b === void 0 ? void 0 : _b.classList.add("darkmode");
                (_c = document.querySelector("body")) === null || _c === void 0 ? void 0 : _c.classList.add("darkmode");
            }
            return true;
        }
        return false;
    };

    /* app/components/common/darkmode/darkmode.svelte generated by Svelte v3.44.2 */
    const file$5 = "app/components/common/darkmode/darkmode.svelte";

    function create_fragment$6(ctx) {
    	let div;
    	let input;
    	let t;
    	let label;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			input = element("input");
    			t = space();
    			label = element("label");
    			attr_dev(input, "id", "dark-mode");
    			attr_dev(input, "type", "checkbox");
    			attr_dev(input, "name", "dark-mode");
    			attr_dev(input, "class", "switch");
    			input.checked = /*checked*/ ctx[0];
    			add_location(input, file$5, 18, 1, 404);
    			attr_dev(label, "for", "dark-mode");
    			add_location(label, file$5, 19, 1, 522);
    			attr_dev(div, "class", "field");
    			add_location(div, file$5, 17, 0, 383);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, input);
    			append_dev(div, t);
    			append_dev(div, label);

    			if (!mounted) {
    				dispose = listen_dev(input, "click", /*click_handler*/ ctx[1], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*checked*/ 1) {
    				prop_dev(input, "checked", /*checked*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Darkmode', slots, []);
    	let checked = darkmode;

    	onMount(async () => {
    		$$invalidate(0, checked = darkModeDetect());
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Darkmode> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => darkModeToggle();

    	$$self.$capture_state = () => ({
    		onMount,
    		darkModeToggle,
    		darkModeDetect,
    		darkmode,
    		checked
    	});

    	$$self.$inject_state = $$props => {
    		if ('checked' in $$props) $$invalidate(0, checked = $$props.checked);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [checked, click_handler];
    }

    class Darkmode extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Darkmode",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* app/components/common/menu/menu.svelte generated by Svelte v3.44.2 */
    const file$4 = "app/components/common/menu/menu.svelte";

    function create_fragment$5(ctx) {
    	let nav;
    	let div0;
    	let a0;
    	let span0;
    	let t0;
    	let span1;
    	let t1;
    	let span2;
    	let t2;
    	let div4;
    	let div3;
    	let a1;
    	let t4;
    	let div2;
    	let a2;
    	let t6;
    	let div1;
    	let a3;
    	let t8;
    	let a4;
    	let t10;
    	let div6;
    	let div5;
    	let darkmode;
    	let current;
    	darkmode = new Darkmode({ $$inline: true });

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			div0 = element("div");
    			a0 = element("a");
    			span0 = element("span");
    			t0 = space();
    			span1 = element("span");
    			t1 = space();
    			span2 = element("span");
    			t2 = space();
    			div4 = element("div");
    			div3 = element("div");
    			a1 = element("a");
    			a1.textContent = "Home";
    			t4 = space();
    			div2 = element("div");
    			a2 = element("a");
    			a2.textContent = "Wild";
    			t6 = space();
    			div1 = element("div");
    			a3 = element("a");
    			a3.textContent = "About";
    			t8 = space();
    			a4 = element("a");
    			a4.textContent = "Contacts";
    			t10 = space();
    			div6 = element("div");
    			div5 = element("div");
    			create_component(darkmode.$$.fragment);
    			attr_dev(span0, "aria-hidden", "true");
    			add_location(span0, file$4, 16, 3, 497);
    			attr_dev(span1, "aria-hidden", "true");
    			add_location(span1, file$4, 17, 3, 528);
    			attr_dev(span2, "aria-hidden", "true");
    			add_location(span2, file$4, 18, 3, 559);
    			attr_dev(a0, "href", "#/");
    			attr_dev(a0, "role", "button");
    			attr_dev(a0, "class", "navbar-burger");
    			attr_dev(a0, "aria-label", "menu");
    			attr_dev(a0, "aria-expanded", "false");
    			attr_dev(a0, "data-target", "navbar-basic");
    			add_location(a0, file$4, 15, 2, 377);
    			attr_dev(div0, "class", "navbar-brand");
    			add_location(div0, file$4, 14, 1, 348);
    			attr_dev(a1, "href", "#/");
    			attr_dev(a1, "class", "navbar-item");
    			add_location(a1, file$4, 24, 3, 680);
    			attr_dev(a2, "href", "#/wild");
    			attr_dev(a2, "class", "navbar-link");
    			add_location(a2, file$4, 27, 4, 784);
    			attr_dev(a3, "href", "#/wild/about");
    			attr_dev(a3, "class", "navbar-item");
    			add_location(a3, file$4, 30, 5, 872);
    			attr_dev(a4, "href", "#/wild/contacts");
    			attr_dev(a4, "class", "navbar-item");
    			add_location(a4, file$4, 31, 5, 932);
    			attr_dev(div1, "class", "navbar-dropdown");
    			add_location(div1, file$4, 29, 4, 837);
    			attr_dev(div2, "class", "navbar-item has-dropdown is-hoverable");
    			add_location(div2, file$4, 26, 3, 728);
    			attr_dev(div3, "class", "navbar-start");
    			add_location(div3, file$4, 23, 2, 650);
    			attr_dev(div4, "id", "navbar-basic");
    			attr_dev(div4, "class", "navbar-menu");
    			add_location(div4, file$4, 22, 1, 604);
    			attr_dev(div5, "class", "navbar-item");
    			add_location(div5, file$4, 38, 2, 1060);
    			attr_dev(div6, "class", "navbar-end");
    			add_location(div6, file$4, 37, 1, 1033);
    			attr_dev(nav, "class", "navbar");
    			attr_dev(nav, "role", "navigation");
    			attr_dev(nav, "aria-label", "main navigation");
    			add_location(nav, file$4, 13, 0, 279);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, div0);
    			append_dev(div0, a0);
    			append_dev(a0, span0);
    			append_dev(a0, t0);
    			append_dev(a0, span1);
    			append_dev(a0, t1);
    			append_dev(a0, span2);
    			append_dev(nav, t2);
    			append_dev(nav, div4);
    			append_dev(div4, div3);
    			append_dev(div3, a1);
    			append_dev(div3, t4);
    			append_dev(div3, div2);
    			append_dev(div2, a2);
    			append_dev(div2, t6);
    			append_dev(div2, div1);
    			append_dev(div1, a3);
    			append_dev(div1, t8);
    			append_dev(div1, a4);
    			append_dev(nav, t10);
    			append_dev(nav, div6);
    			append_dev(div6, div5);
    			mount_component(darkmode, div5, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(darkmode.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(darkmode.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    			destroy_component(darkmode);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Menu', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Menu> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ DarkMode: Darkmode });
    	return [];
    }

    class Menu extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Menu",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* app/components/common/footer/footer.svelte generated by Svelte v3.44.2 */
    const file$3 = "app/components/common/footer/footer.svelte";

    function create_fragment$4(ctx) {
    	let footer;
    	let div;
    	let p;
    	let t0;
    	let a;
    	let t2;

    	const block = {
    		c: function create() {
    			footer = element("footer");
    			div = element("div");
    			p = element("p");
    			t0 = text("The source code is licensed\n\t\t\t");
    			a = element("a");
    			a.textContent = "MIT";
    			t2 = text(".");
    			attr_dev(a, "href", "http://opensource.org/licenses/mit-license.php");
    			add_location(a, file$3, 16, 3, 320);
    			add_location(p, file$3, 14, 2, 282);
    			attr_dev(div, "class", "content has-text-centered");
    			add_location(div, file$3, 13, 1, 240);
    			attr_dev(footer, "class", "footer");
    			add_location(footer, file$3, 12, 0, 215);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, footer, anchor);
    			append_dev(footer, div);
    			append_dev(div, p);
    			append_dev(p, t0);
    			append_dev(p, a);
    			append_dev(p, t2);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Footer', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* app/pages/home/home.svelte generated by Svelte v3.44.2 */
    const file$2 = "app/pages/home/home.svelte";

    function create_fragment$3(ctx) {
    	let menu;
    	let t0;
    	let div3;
    	let section;
    	let div1;
    	let div0;
    	let h1;
    	let t2;
    	let h2;
    	let t4;
    	let div2;
    	let t6;
    	let footer;
    	let current;
    	menu = new Menu({ $$inline: true });
    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(menu.$$.fragment);
    			t0 = space();
    			div3 = element("div");
    			section = element("section");
    			div1 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Hello World";
    			t2 = space();
    			h2 = element("h2");
    			h2.textContent = "svelte-cordova-boilerplate";
    			t4 = space();
    			div2 = element("div");
    			div2.textContent = "app/pages/home.svelte";
    			t6 = space();
    			create_component(footer.$$.fragment);
    			attr_dev(h1, "class", "title");
    			add_location(h1, file$2, 19, 4, 450);
    			attr_dev(h2, "class", "subtitle");
    			add_location(h2, file$2, 20, 4, 489);
    			attr_dev(div0, "class", "container");
    			add_location(div0, file$2, 18, 3, 422);
    			attr_dev(div1, "class", "hero-body");
    			add_location(div1, file$2, 17, 2, 395);
    			attr_dev(section, "class", "hero is-medium is-primary is-bold");
    			add_location(section, file$2, 16, 1, 341);
    			attr_dev(div2, "class", "content has-text-centered");
    			add_location(div2, file$2, 24, 1, 574);
    			attr_dev(div3, "id", "container");
    			add_location(div3, file$2, 15, 0, 319);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(menu, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div3, anchor);
    			append_dev(div3, section);
    			append_dev(section, div1);
    			append_dev(div1, div0);
    			append_dev(div0, h1);
    			append_dev(div0, t2);
    			append_dev(div0, h2);
    			append_dev(div3, t4);
    			append_dev(div3, div2);
    			insert_dev(target, t6, anchor);
    			mount_component(footer, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(menu.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(menu.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(menu, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div3);
    			if (detaching) detach_dev(t6);
    			destroy_component(footer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Home', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Home> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Menu, Footer });
    	return [];
    }

    class Home extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Home",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* app/pages/wild/wild.svelte generated by Svelte v3.44.2 */
    const file$1 = "app/pages/wild/wild.svelte";

    function create_fragment$2(ctx) {
    	let menu;
    	let t0;
    	let div3;
    	let section;
    	let div1;
    	let div0;
    	let h1;
    	let t2;
    	let div2;
    	let p0;
    	let t3;
    	let code0;
    	let t5;
    	let code1;
    	let t7;
    	let t8;
    	let p1;
    	let t9;
    	let t10_value = /*params*/ ctx[0].wild + "";
    	let t10;
    	let t11;
    	let footer;
    	let current;
    	menu = new Menu({ $$inline: true });
    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(menu.$$.fragment);
    			t0 = space();
    			div3 = element("div");
    			section = element("section");
    			div1 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Wildcard!";
    			t2 = space();
    			div2 = element("div");
    			p0 = element("p");
    			t3 = text("Anything in the URL after ");
    			code0 = element("code");
    			code0.textContent = "/wild/";
    			t5 = text(" is shown below as message. That's found in the ");
    			code1 = element("code");
    			code1.textContent = "params.wild";
    			t7 = text(" prop.");
    			t8 = space();
    			p1 = element("p");
    			t9 = text("Your message is: ");
    			t10 = text(t10_value);
    			t11 = space();
    			create_component(footer.$$.fragment);
    			attr_dev(h1, "class", "title");
    			add_location(h1, file$1, 21, 4, 499);
    			attr_dev(div0, "class", "container");
    			add_location(div0, file$1, 20, 3, 471);
    			attr_dev(div1, "class", "hero-body");
    			add_location(div1, file$1, 19, 2, 444);
    			attr_dev(section, "class", "hero is-medium is-primary is-bold");
    			add_location(section, file$1, 18, 1, 390);
    			add_location(code0, file$1, 27, 29, 639);
    			add_location(code1, file$1, 27, 96, 706);
    			add_location(p0, file$1, 26, 2, 606);
    			add_location(p1, file$1, 30, 2, 747);
    			attr_dev(div2, "class", "content has-text-centered");
    			add_location(div2, file$1, 25, 1, 564);
    			attr_dev(div3, "id", "container");
    			add_location(div3, file$1, 17, 0, 368);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(menu, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div3, anchor);
    			append_dev(div3, section);
    			append_dev(section, div1);
    			append_dev(div1, div0);
    			append_dev(div0, h1);
    			append_dev(div3, t2);
    			append_dev(div3, div2);
    			append_dev(div2, p0);
    			append_dev(p0, t3);
    			append_dev(p0, code0);
    			append_dev(p0, t5);
    			append_dev(p0, code1);
    			append_dev(p0, t7);
    			append_dev(div2, t8);
    			append_dev(div2, p1);
    			append_dev(p1, t9);
    			append_dev(p1, t10);
    			insert_dev(target, t11, anchor);
    			mount_component(footer, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*params*/ 1) && t10_value !== (t10_value = /*params*/ ctx[0].wild + "")) set_data_dev(t10, t10_value);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(menu.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(menu.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(menu, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div3);
    			if (detaching) detach_dev(t11);
    			destroy_component(footer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Wild', slots, []);
    	let { params = { wild: "" } } = $$props;
    	const writable_props = ['params'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Wild> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('params' in $$props) $$invalidate(0, params = $$props.params);
    	};

    	$$self.$capture_state = () => ({ Menu, Footer, params });

    	$$self.$inject_state = $$props => {
    		if ('params' in $$props) $$invalidate(0, params = $$props.params);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [params];
    }

    class Wild extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { params: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Wild",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get params() {
    		throw new Error("<Wild>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set params(value) {
    		throw new Error("<Wild>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* app/pages/404/404.svelte generated by Svelte v3.44.2 */
    const file = "app/pages/404/404.svelte";

    function create_fragment$1(ctx) {
    	let menu;
    	let t0;
    	let div3;
    	let section;
    	let div1;
    	let div0;
    	let h1;
    	let t2;
    	let div2;
    	let p;
    	let t4;
    	let footer;
    	let current;
    	menu = new Menu({ $$inline: true });
    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(menu.$$.fragment);
    			t0 = space();
    			div3 = element("div");
    			section = element("section");
    			div1 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Not Found!";
    			t2 = space();
    			div2 = element("div");
    			p = element("p");
    			p.textContent = "Oops, this route doesn't exist!";
    			t4 = space();
    			create_component(footer.$$.fragment);
    			attr_dev(h1, "class", "title");
    			add_location(h1, file, 19, 4, 454);
    			attr_dev(div0, "class", "container");
    			add_location(div0, file, 18, 3, 426);
    			attr_dev(div1, "class", "hero-body");
    			add_location(div1, file, 17, 2, 399);
    			attr_dev(section, "class", "hero is-medium is-primary is-bold");
    			add_location(section, file, 16, 1, 345);
    			add_location(p, file, 24, 2, 562);
    			attr_dev(div2, "class", "content has-text-centered");
    			add_location(div2, file, 23, 1, 520);
    			attr_dev(div3, "id", "container");
    			add_location(div3, file, 15, 0, 323);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(menu, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div3, anchor);
    			append_dev(div3, section);
    			append_dev(section, div1);
    			append_dev(div1, div0);
    			append_dev(div0, h1);
    			append_dev(div3, t2);
    			append_dev(div3, div2);
    			append_dev(div2, p);
    			insert_dev(target, t4, anchor);
    			mount_component(footer, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(menu.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(menu.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(menu, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div3);
    			if (detaching) detach_dev(t4);
    			destroy_component(footer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('_404', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<_404> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Menu, Footer });
    	return [];
    }

    class _404 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "_404",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /**
     * Routes
     * =====================
     * All app routes
     *
     * @contributors: Patryk Rzucidło [@ptkdev] <support@ptkdev.io> (https://ptk.dev)
     *
     * @license: MIT License
     *
     */
    var routes = {
        "/": Home,
        "/wild": Wild,
        "/wild/*": Wild,
        "*": _404,
    };

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    var bulmaExtensions_min = {exports: {}};

    (function (module, exports) {
    !function(e,t){module.exports=t();}("undefined"!=typeof self?self:commonjsGlobal,function(){return function(n){var o={};function r(e){if(o[e])return o[e].exports;var t=o[e]={i:e,l:!1,exports:{}};return n[e].call(t.exports,t,t.exports,r),t.l=!0,t.exports}return r.m=n,r.c=o,r.d=function(e,t,n){r.o(e,t)||Object.defineProperty(e,t,{configurable:!1,enumerable:!0,get:n});},r.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return r.d(t,"a",t),t},r.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},r.p="",r(r.s=196)}([function(e,t,n){var h=n(115),m=36e5,p=6e4,v=/[T ]/,g=/:/,_=/^(\d{2})$/,y=[/^([+-]\d{2})$/,/^([+-]\d{3})$/,/^([+-]\d{4})$/],b=/^(\d{4})/,x=[/^([+-]\d{4})/,/^([+-]\d{5})/,/^([+-]\d{6})/],M=/^-(\d{2})$/,k=/^-?(\d{3})$/,w=/^-?(\d{2})-?(\d{2})$/,D=/^-?W(\d{2})$/,S=/^-?W(\d{2})-?(\d{1})$/,j=/^(\d{2}([.,]\d*)?)$/,E=/^(\d{2}):?(\d{2}([.,]\d*)?)$/,A=/^(\d{2}):?(\d{2}):?(\d{2}([.,]\d*)?)$/,T=/([Z+-].*)$/,O=/^(Z)$/,Y=/^([+-])(\d{2})$/,H=/^([+-])(\d{2}):?(\d{2})$/;function X(e,t,n){t=t||0,n=n||0;var o=new Date(0);o.setUTCFullYear(e,0,4);var r=7*t+n+1-(o.getUTCDay()||7);return o.setUTCDate(o.getUTCDate()+r),o}e.exports=function(e,t){if(h(e))return new Date(e.getTime());if("string"!=typeof e)return new Date(e);var n=(t||{}).additionalDigits;n=null==n?2:Number(n);var o=function(e){var t,n={},o=e.split(v);if(g.test(o[0])?(n.date=null,t=o[0]):(n.date=o[0],t=o[1]),t){var r=T.exec(t);r?(n.time=t.replace(r[1],""),n.timezone=r[1]):n.time=t;}return n}(e),r=function(e,t){var n,o=y[t],r=x[t];if(n=b.exec(e)||r.exec(e)){var i=n[1];return {year:parseInt(i,10),restDateString:e.slice(i.length)}}if(n=_.exec(e)||o.exec(e)){var a=n[1];return {year:100*parseInt(a,10),restDateString:e.slice(a.length)}}return {year:null}}(o.date,n),i=r.year,a=function(e,t){if(null===t)return null;var n,o,r,i;if(0===e.length)return (o=new Date(0)).setUTCFullYear(t),o;if(n=M.exec(e))return o=new Date(0),r=parseInt(n[1],10)-1,o.setUTCFullYear(t,r),o;if(n=k.exec(e)){o=new Date(0);var a=parseInt(n[1],10);return o.setUTCFullYear(t,0,a),o}if(n=w.exec(e)){o=new Date(0),r=parseInt(n[1],10)-1;var s=parseInt(n[2],10);return o.setUTCFullYear(t,r,s),o}if(n=D.exec(e))return i=parseInt(n[1],10)-1,X(t,i);if(n=S.exec(e)){i=parseInt(n[1],10)-1;var u=parseInt(n[2],10)-1;return X(t,i,u)}return null}(r.restDateString,i);if(a){var s,u=a.getTime(),c=0;return o.time&&(c=function(e){var t,n,o;if(t=j.exec(e))return (n=parseFloat(t[1].replace(",",".")))%24*m;if(t=E.exec(e))return n=parseInt(t[1],10),o=parseFloat(t[2].replace(",",".")),n%24*m+o*p;if(t=A.exec(e)){n=parseInt(t[1],10),o=parseInt(t[2],10);var r=parseFloat(t[3].replace(",","."));return n%24*m+o*p+1e3*r}return null}(o.time)),o.timezone?(l=o.timezone,s=(d=O.exec(l))?0:(d=Y.exec(l))?(f=60*parseInt(d[2],10),"+"===d[1]?-f:f):(d=H.exec(l))?(f=60*parseInt(d[2],10)+parseInt(d[3],10),"+"===d[1]?-f:f):0):(s=new Date(u+c).getTimezoneOffset(),s=new Date(u+c+s*p).getTimezoneOffset()),new Date(u+c+s*p)}var l,d,f;return new Date(e)};},function(e,t){var r=["M","MM","Q","D","DD","DDD","DDDD","d","E","W","WW","YY","YYYY","GG","GGGG","H","HH","h","hh","m","mm","s","ss","S","SS","SSS","Z","ZZ","X","x"];e.exports=function(e){var t=[];for(var n in e)e.hasOwnProperty(n)&&t.push(n);var o=r.concat(t).sort().reverse();return new RegExp("(\\[[^\\[]*\\])|(\\\\)?("+o.join("|")+"|.)","g")};},function(e,t,n){var s=n(0),u=n(3);e.exports=function(e){var t=s(e),n=t.getFullYear(),o=new Date(0);o.setFullYear(n+1,0,4),o.setHours(0,0,0,0);var r=u(o),i=new Date(0);i.setFullYear(n,0,4),i.setHours(0,0,0,0);var a=u(i);return t.getTime()>=r.getTime()?n+1:t.getTime()>=a.getTime()?n:n-1};},function(e,t,n){var o=n(78);e.exports=function(e){return o(e,{weekStartsOn:1})};},function(e,t,n){var o=n(0);e.exports=function(e){var t=o(e);return t.setHours(0,0,0,0),t};},function(e,t,n){var o=n(10),r=n(11);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var r=n(0);e.exports=function(e,t){var n=r(e),o=Number(t);return n.setDate(n.getDate()+o),n};},function(e,t,n){var r=n(0);e.exports=function(e,t){var n=r(e).getTime(),o=Number(t);return new Date(n+o)};},function(e,t,n){var o=n(2),r=n(3);e.exports=function(e){var t=o(e),n=new Date(0);return n.setFullYear(t,0,4),n.setHours(0,0,0,0),r(n)};},function(e,t,n){var r=n(0);e.exports=function(e,t){var n=r(e).getTime(),o=r(t).getTime();return n<o?-1:o<n?1:0};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"less than a second",other:"less than {{count}} seconds"},xSeconds:{one:"1 second",other:"{{count}} seconds"},halfAMinute:"half a minute",lessThanXMinutes:{one:"less than a minute",other:"less than {{count}} minutes"},xMinutes:{one:"1 minute",other:"{{count}} minutes"},aboutXHours:{one:"about 1 hour",other:"about {{count}} hours"},xHours:{one:"1 hour",other:"{{count}} hours"},xDays:{one:"1 day",other:"{{count}} days"},aboutXMonths:{one:"about 1 month",other:"about {{count}} months"},xMonths:{one:"1 month",other:"{{count}} months"},aboutXYears:{one:"about 1 year",other:"about {{count}} years"},xYears:{one:"1 year",other:"{{count}} years"},overXYears:{one:"over 1 year",other:"over {{count}} years"},almostXYears:{one:"almost 1 year",other:"almost {{count}} years"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"in "+o:o+" ago":o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],n=["January","February","March","April","May","June","July","August","September","October","November","December"],o=["Su","Mo","Tu","We","Th","Fr","Sa"],r=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],i=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],a=["AM","PM"],s=["am","pm"],u=["a.m.","p.m."],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return function(e){var t=e%100;if(20<t||t<10)switch(t%10){case 1:return e+"st";case 2:return e+"nd";case 3:return e+"rd"}return e+"th"}(t[n](e))};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"أقل من ثانية واحدة",other:"أقل من {{count}} ثواني"},xSeconds:{one:"ثانية واحدة",other:"{{count}} ثواني"},halfAMinute:"نصف دقيقة",lessThanXMinutes:{one:"أقل من دقيقة",other:"أقل من {{count}} دقيقة"},xMinutes:{one:"دقيقة واحدة",other:"{{count}} دقائق"},aboutXHours:{one:"ساعة واحدة تقريباً",other:"{{count}} ساعات تقريباً"},xHours:{one:"ساعة واحدة",other:"{{count}} ساعات"},xDays:{one:"يوم واحد",other:"{{count}} أيام"},aboutXMonths:{one:"شهر واحد تقريباً",other:"{{count}} أشهر تقريباً"},xMonths:{one:"شهر واحد",other:"{{count}} أشهر"},aboutXYears:{one:"عام واحد تقريباً",other:"{{count}} أعوام تقريباً"},xYears:{one:"عام واحد",other:"{{count}} أعوام"},overXYears:{one:"أكثر من عام",other:"أكثر من {{count}} أعوام"},almostXYears:{one:"عام واحد تقريباً",other:"{{count}} أعوام تقريباً"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"في خلال "+o:"منذ "+o:o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"],n=["كانون الثاني يناير","شباط فبراير","آذار مارس","نيسان أبريل","أيار مايو","حزيران يونيو","تموز يوليو","آب أغسطس","أيلول سبتمبر","تشرين الأول أكتوبر","تشرين الثاني نوفمبر","كانون الأول ديسمبر"],o=["ح","ن","ث","ر","خ","ج","س"],r=["أحد","إثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"],i=["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"],a=["صباح","مساء"],s=["ص","م"],u=["صباحاً","مساءاً"],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(o){e[o+"o"]=function(e,t){return n=t[o](e),String(n);var n;};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"по-малко от секунда",other:"по-малко от {{count}} секунди"},xSeconds:{one:"1 секунда",other:"{{count}} секунди"},halfAMinute:"половин минута",lessThanXMinutes:{one:"по-малко от минута",other:"по-малко от {{count}} минути"},xMinutes:{one:"1 минута",other:"{{count}} минути"},aboutXHours:{one:"около час",other:"около {{count}} часа"},xHours:{one:"1 час",other:"{{count}} часа"},xDays:{one:"1 ден",other:"{{count}} дни"},aboutXMonths:{one:"около месец",other:"около {{count}} месеца"},xMonths:{one:"1 месец",other:"{{count}} месеца"},aboutXYears:{one:"около година",other:"около {{count}} години"},xYears:{one:"1 година",other:"{{count}} години"},overXYears:{one:"над година",other:"над {{count}} години"},almostXYears:{one:"почти година",other:"почти {{count}} години"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"след "+o:"преди "+o:o}}};},function(e,t,n){var u=n(1);e.exports=function(){var t=["яну","фев","мар","апр","май","юни","юли","авг","сеп","окт","ное","дек"],n=["януари","февруари","март","април","май","юни","юли","август","септември","октомври","ноември","декември"],o=["нд","пн","вт","ср","чт","пт","сб"],r=["нед","пон","вто","сря","чет","пет","съб"],i=["неделя","понеделник","вторник","сряда","четвъртък","петък","събота"],a=["сутринта","на обяд","следобед","вечерта"],e=function(e){var t=e.getHours();return 4<=t&&t<12?a[0]:12<=t&&t<14?a[1]:14<=t&&t<17?a[2]:a[3]},s={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:e,a:e,aa:e};return ["M","D","DDD","d","Q","W"].forEach(function(n){s[n+"o"]=function(e,t){return function(e){var t=e%100;if(20<t||t<10)switch(t%10){case 1:return e+"-ви";case 2:return e+"-ри"}return e+"-и"}(t[n](e))};}),{formatters:s,formattingTokensRegExp:u(s)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"menys d'un segon",other:"menys de {{count}} segons"},xSeconds:{one:"1 segon",other:"{{count}} segons"},halfAMinute:"mig minut",lessThanXMinutes:{one:"menys d'un minut",other:"menys de {{count}} minuts"},xMinutes:{one:"1 minut",other:"{{count}} minuts"},aboutXHours:{one:"aproximadament una hora",other:"aproximadament {{count}} hores"},xHours:{one:"1 hora",other:"{{count}} hores"},xDays:{one:"1 dia",other:"{{count}} dies"},aboutXMonths:{one:"aproximadament un mes",other:"aproximadament {{count}} mesos"},xMonths:{one:"1 mes",other:"{{count}} mesos"},aboutXYears:{one:"aproximadament un any",other:"aproximadament {{count}} anys"},xYears:{one:"1 any",other:"{{count}} anys"},overXYears:{one:"més d'un any",other:"més de {{count}} anys"},almostXYears:{one:"gairebé un any",other:"gairebé {{count}} anys"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"en "+o:"fa "+o:o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["gen","feb","mar","abr","mai","jun","jul","ago","set","oct","nov","des"],n=["gener","febrer","març","abril","maig","juny","juliol","agost","setembre","octobre","novembre","desembre"],o=["dg","dl","dt","dc","dj","dv","ds"],r=["dge","dls","dts","dcs","djs","dvs","dss"],i=["diumenge","dilluns","dimarts","dimecres","dijous","divendres","dissabte"],a=["AM","PM"],s=["am","pm"],u=["a.m.","p.m."],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return function(e){switch(e){case 1:return "1r";case 2:return "2n";case 3:return "3r";case 4:return "4t";default:return e+"è"}}(t[n](e))};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){function c(e,t,n){var o,r,i=(o=e,1===(r=t)?o.one:2<=r&&r<=4?o.twoFour:o.other);return (i[n]||i).replace("{{count}}",t)}function l(e){var t="";return "almost"===e&&(t="skoro"),"about"===e&&(t="přibližně"),0<t.length?t+" ":""}function d(e){var t="";return "lessThan"===e&&(t="méně než"),"over"===e&&(t="více než"),0<t.length?t+" ":""}e.exports=function(){var u={xSeconds:{one:{regular:"vteřina",past:"vteřinou",future:"vteřinu"},twoFour:{regular:"{{count}} vteřiny",past:"{{count}} vteřinami",future:"{{count}} vteřiny"},other:{regular:"{{count}} vteřin",past:"{{count}} vteřinami",future:"{{count}} vteřin"}},halfAMinute:{other:{regular:"půl minuty",past:"půl minutou",future:"půl minuty"}},xMinutes:{one:{regular:"minuta",past:"minutou",future:"minutu"},twoFour:{regular:"{{count}} minuty",past:"{{count}} minutami",future:"{{count}} minuty"},other:{regular:"{{count}} minut",past:"{{count}} minutami",future:"{{count}} minut"}},xHours:{one:{regular:"hodina",past:"hodinou",future:"hodinu"},twoFour:{regular:"{{count}} hodiny",past:"{{count}} hodinami",future:"{{count}} hodiny"},other:{regular:"{{count}} hodin",past:"{{count}} hodinami",future:"{{count}} hodin"}},xDays:{one:{regular:"den",past:"dnem",future:"den"},twoFour:{regular:"{{count}} dni",past:"{{count}} dny",future:"{{count}} dni"},other:{regular:"{{count}} dní",past:"{{count}} dny",future:"{{count}} dní"}},xMonths:{one:{regular:"měsíc",past:"měsícem",future:"měsíc"},twoFour:{regular:"{{count}} měsíce",past:"{{count}} měsíci",future:"{{count}} měsíce"},other:{regular:"{{count}} měsíců",past:"{{count}} měsíci",future:"{{count}} měsíců"}},xYears:{one:{regular:"rok",past:"rokem",future:"rok"},twoFour:{regular:"{{count}} roky",past:"{{count}} roky",future:"{{count}} roky"},other:{regular:"{{count}} roků",past:"{{count}} roky",future:"{{count}} roků"}}};return {localize:function(e,t,n){n=n||{};var o,r,i=(o=e,["lessThan","about","over","almost"].filter(function(e){return !!o.match(new RegExp("^"+e))})[0]||""),a=(r=e.substring(i.length)).charAt(0).toLowerCase()+r.slice(1),s=u[a];return n.addSuffix?0<n.comparison?l(i)+"za "+d(i)+c(s,t,"future"):l(i)+"před "+d(i)+c(s,t,"past"):l(i)+d(i)+c(s,t,"regular")}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["led","úno","bře","dub","kvě","čvn","čvc","srp","zář","říj","lis","pro"],n=["leden","únor","březen","duben","květen","červen","červenec","srpen","září","říjen","listopad","prosinec"],o=["ne","po","út","st","čt","pá","so"],r=["ned","pon","úte","stř","čtv","pát","sob"],i=["neděle","pondělí","úterý","středa","čtvrtek","pátek","sobota"],a=["DOP.","ODP."],s=["dop.","odp."],u=["dopoledne","odpoledne"],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return t[n](e)+"."};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"mindre end et sekund",other:"mindre end {{count}} sekunder"},xSeconds:{one:"1 sekund",other:"{{count}} sekunder"},halfAMinute:"et halvt minut",lessThanXMinutes:{one:"mindre end et minut",other:"mindre end {{count}} minutter"},xMinutes:{one:"1 minut",other:"{{count}} minutter"},aboutXHours:{one:"cirka 1 time",other:"cirka {{count}} timer"},xHours:{one:"1 time",other:"{{count}} timer"},xDays:{one:"1 dag",other:"{{count}} dage"},aboutXMonths:{one:"cirka 1 måned",other:"cirka {{count}} måneder"},xMonths:{one:"1 måned",other:"{{count}} måneder"},aboutXYears:{one:"cirka 1 år",other:"cirka {{count}} år"},xYears:{one:"1 år",other:"{{count}} år"},overXYears:{one:"over 1 år",other:"over {{count}} år"},almostXYears:{one:"næsten 1 år",other:"næsten {{count}} år"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"om "+o:o+" siden":o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"],n=["januar","februar","marts","april","maj","juni","juli","august","september","oktober","november","december"],o=["sø","ma","ti","on","to","fr","lø"],r=["søn","man","tir","ons","tor","fre","lør"],i=["søndag","mandag","tirsdag","onsdag","torsdag","fredag","lørdag"],a=["AM","PM"],s=["am","pm"],u=["a.m.","p.m."],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return t[n](e)+"."};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){e.exports=function(){var i={lessThanXSeconds:{standalone:{one:"weniger als eine Sekunde",other:"weniger als {{count}} Sekunden"},withPreposition:{one:"weniger als einer Sekunde",other:"weniger als {{count}} Sekunden"}},xSeconds:{standalone:{one:"eine Sekunde",other:"{{count}} Sekunden"},withPreposition:{one:"einer Sekunde",other:"{{count}} Sekunden"}},halfAMinute:{standalone:"eine halbe Minute",withPreposition:"einer halben Minute"},lessThanXMinutes:{standalone:{one:"weniger als eine Minute",other:"weniger als {{count}} Minuten"},withPreposition:{one:"weniger als einer Minute",other:"weniger als {{count}} Minuten"}},xMinutes:{standalone:{one:"eine Minute",other:"{{count}} Minuten"},withPreposition:{one:"einer Minute",other:"{{count}} Minuten"}},aboutXHours:{standalone:{one:"etwa eine Stunde",other:"etwa {{count}} Stunden"},withPreposition:{one:"etwa einer Stunde",other:"etwa {{count}} Stunden"}},xHours:{standalone:{one:"eine Stunde",other:"{{count}} Stunden"},withPreposition:{one:"einer Stunde",other:"{{count}} Stunden"}},xDays:{standalone:{one:"ein Tag",other:"{{count}} Tage"},withPreposition:{one:"einem Tag",other:"{{count}} Tagen"}},aboutXMonths:{standalone:{one:"etwa ein Monat",other:"etwa {{count}} Monate"},withPreposition:{one:"etwa einem Monat",other:"etwa {{count}} Monaten"}},xMonths:{standalone:{one:"ein Monat",other:"{{count}} Monate"},withPreposition:{one:"einem Monat",other:"{{count}} Monaten"}},aboutXYears:{standalone:{one:"etwa ein Jahr",other:"etwa {{count}} Jahre"},withPreposition:{one:"etwa einem Jahr",other:"etwa {{count}} Jahren"}},xYears:{standalone:{one:"ein Jahr",other:"{{count}} Jahre"},withPreposition:{one:"einem Jahr",other:"{{count}} Jahren"}},overXYears:{standalone:{one:"mehr als ein Jahr",other:"mehr als {{count}} Jahre"},withPreposition:{one:"mehr als einem Jahr",other:"mehr als {{count}} Jahren"}},almostXYears:{standalone:{one:"fast ein Jahr",other:"fast {{count}} Jahre"},withPreposition:{one:"fast einem Jahr",other:"fast {{count}} Jahren"}}};return {localize:function(e,t,n){var o,r=(n=n||{}).addSuffix?i[e].withPreposition:i[e].standalone;return o="string"==typeof r?r:1===t?r.one:r.other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"in "+o:"vor "+o:o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"],n=["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"],o=["So","Mo","Di","Mi","Do","Fr","Sa"],r=["Son","Mon","Die","Mit","Don","Fre","Sam"],i=["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"],a=["AM","PM"],s=["am","pm"],u=["a.m.","p.m."],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return t[n](e)+"."};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"λιγότερο από ένα δευτερόλεπτο",other:"λιγότερο από {{count}} δευτερόλεπτα"},xSeconds:{one:"1 δευτερόλεπτο",other:"{{count}} δευτερόλεπτα"},halfAMinute:"μισό λεπτό",lessThanXMinutes:{one:"λιγότερο από ένα λεπτό",other:"λιγότερο από {{count}} λεπτά"},xMinutes:{one:"1 λεπτό",other:"{{count}} λεπτά"},aboutXHours:{one:"περίπου 1 ώρα",other:"περίπου {{count}} ώρες"},xHours:{one:"1 ώρα",other:"{{count}} ώρες"},xDays:{one:"1 ημέρα",other:"{{count}} ημέρες"},aboutXMonths:{one:"περίπου 1 μήνας",other:"περίπου {{count}} μήνες"},xMonths:{one:"1 μήνας",other:"{{count}} μήνες"},aboutXYears:{one:"περίπου 1 χρόνο",other:"περίπου {{count}} χρόνια"},xYears:{one:"1 χρόνο",other:"{{count}} χρόνια"},overXYears:{one:"πάνω από 1 χρόνο",other:"πάνω από {{count}} χρόνια"},almostXYears:{one:"περίπου 1 χρόνο",other:"περίπου {{count}} χρόνια"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"σε "+o:o+" πρίν":o}}};},function(e,t,n){var f=n(1);e.exports=function(){var t=["Ιαν","Φεβ","Μαρ","Απρ","Μαϊ","Ιουν","Ιουλ","Αυγ","Σεπ","Οκτ","Νοε","Δεκ"],n=["Ιανουάριος","Φεβρουάριος","Μάρτιος","Απρίλιος","Μάιος","Ιούνιος","Ιούλιος","Αύγουστος","Σεπτέμβριος","Οκτώβριος","Νοέμβριος","Δεκέμβριος"],o=["Ιανουαρίου","Φεβρουαρίου","Μαρτίου","Απριλίου","Μαΐου","Ιουνίου","Ιουλίου","Αυγούστου","Σεπτεμβρίου","Οκτωβρίου","Νοεμβρίου","Δεκεμβρίου"],r=["Κυ","Δε","Τρ","Τε","Πέ","Πα","Σά"],i=["Κυρ","Δευ","Τρί","Τετ","Πέμ","Παρ","Σάβ"],a=["Κυριακή","Δευτέρα","Τρίτη","Τετάρτη","Πέμπτη","Παρασκευή","Σάββατο"],s=["ΠΜ","ΜΜ"],u=["πμ","μμ"],c=["π.μ.","μ.μ."],l={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return r[e.getDay()]},ddd:function(e){return i[e.getDay()]},dddd:function(e){return a[e.getDay()]},A:function(e){return 1<=e.getHours()/12?s[1]:s[0]},a:function(e){return 1<=e.getHours()/12?u[1]:u[0]},aa:function(e){return 1<=e.getHours()/12?c[1]:c[0]}},d={M:"ος",D:"η",DDD:"η",d:"η",Q:"ο",W:"η"};return ["M","D","DDD","d","Q","W"].forEach(function(n){l[n+"o"]=function(e,t){return t[n](e)+d[n]};}),["D","Do","DD"].forEach(function(n){l[n+" MMMM"]=function(e,t){return (l[n]||t[n])(e,t)+" "+o[e.getMonth()]};}),{formatters:l,formattingTokensRegExp:f(l)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"malpli ol sekundo",other:"malpli ol {{count}} sekundoj"},xSeconds:{one:"1 sekundo",other:"{{count}} sekundoj"},halfAMinute:"duonminuto",lessThanXMinutes:{one:"malpli ol minuto",other:"malpli ol {{count}} minutoj"},xMinutes:{one:"1 minuto",other:"{{count}} minutoj"},aboutXHours:{one:"proksimume 1 horo",other:"proksimume {{count}} horoj"},xHours:{one:"1 horo",other:"{{count}} horoj"},xDays:{one:"1 tago",other:"{{count}} tagoj"},aboutXMonths:{one:"proksimume 1 monato",other:"proksimume {{count}} monatoj"},xMonths:{one:"1 monato",other:"{{count}} monatoj"},aboutXYears:{one:"proksimume 1 jaro",other:"proksimume {{count}} jaroj"},xYears:{one:"1 jaro",other:"{{count}} jaroj"},overXYears:{one:"pli ol 1 jaro",other:"pli ol {{count}} jaroj"},almostXYears:{one:"preskaŭ 1 jaro",other:"preskaŭ {{count}} jaroj"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"post "+o:"antaŭ "+o:o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["jan","feb","mar","apr","maj","jun","jul","aŭg","sep","okt","nov","dec"],n=["januaro","februaro","marto","aprilo","majo","junio","julio","aŭgusto","septembro","oktobro","novembro","decembro"],o=["di","lu","ma","me","ĵa","ve","sa"],r=["dim","lun","mar","mer","ĵaŭ","ven","sab"],i=["dimanĉo","lundo","mardo","merkredo","ĵaŭdo","vendredo","sabato"],a=["A.T.M.","P.T.M."],s=["a.t.m.","p.t.m."],u=["antaŭtagmeze","posttagmeze"],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return t[n](e)+"-a"};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"menos de un segundo",other:"menos de {{count}} segundos"},xSeconds:{one:"1 segundo",other:"{{count}} segundos"},halfAMinute:"medio minuto",lessThanXMinutes:{one:"menos de un minuto",other:"menos de {{count}} minutos"},xMinutes:{one:"1 minuto",other:"{{count}} minutos"},aboutXHours:{one:"alrededor de 1 hora",other:"alrededor de {{count}} horas"},xHours:{one:"1 hora",other:"{{count}} horas"},xDays:{one:"1 día",other:"{{count}} días"},aboutXMonths:{one:"alrededor de 1 mes",other:"alrededor de {{count}} meses"},xMonths:{one:"1 mes",other:"{{count}} meses"},aboutXYears:{one:"alrededor de 1 año",other:"alrededor de {{count}} años"},xYears:{one:"1 año",other:"{{count}} años"},overXYears:{one:"más de 1 año",other:"más de {{count}} años"},almostXYears:{one:"casi 1 año",other:"casi {{count}} años"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"en "+o:"hace "+o:o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"],n=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"],o=["do","lu","ma","mi","ju","vi","sa"],r=["dom","lun","mar","mié","jue","vie","sáb"],i=["domingo","lunes","martes","miércoles","jueves","viernes","sábado"],a=["AM","PM"],s=["am","pm"],u=["a.m.","p.m."],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return t[n](e)+"º"};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){e.exports=function(){function e(e){return e.replace(/sekuntia?/,"sekunnin")}function t(e){return e.replace(/minuuttia?/,"minuutin")}function n(e){return e.replace(/tuntia?/,"tunnin")}function o(e){return e.replace(/(kuukausi|kuukautta)/,"kuukauden")}function r(e){return e.replace(/(vuosi|vuotta)/,"vuoden")}var i={lessThanXSeconds:{one:"alle sekunti",other:"alle {{count}} sekuntia",futureTense:e},xSeconds:{one:"sekunti",other:"{{count}} sekuntia",futureTense:e},halfAMinute:{one:"puoli minuuttia",other:"puoli minuuttia",futureTense:function(e){return "puolen minuutin"}},lessThanXMinutes:{one:"alle minuutti",other:"alle {{count}} minuuttia",futureTense:t},xMinutes:{one:"minuutti",other:"{{count}} minuuttia",futureTense:t},aboutXHours:{one:"noin tunti",other:"noin {{count}} tuntia",futureTense:n},xHours:{one:"tunti",other:"{{count}} tuntia",futureTense:n},xDays:{one:"päivä",other:"{{count}} päivää",futureTense:function(e){return e.replace(/päivää?/,"päivän")}},aboutXMonths:{one:"noin kuukausi",other:"noin {{count}} kuukautta",futureTense:o},xMonths:{one:"kuukausi",other:"{{count}} kuukautta",futureTense:o},aboutXYears:{one:"noin vuosi",other:"noin {{count}} vuotta",futureTense:r},xYears:{one:"vuosi",other:"{{count}} vuotta",futureTense:r},overXYears:{one:"yli vuosi",other:"yli {{count}} vuotta",futureTense:r},almostXYears:{one:"lähes vuosi",other:"lähes {{count}} vuotta",futureTense:r}};return {localize:function(e,t,n){n=n||{};var o=i[e],r=1===t?o.one:o.other.replace("{{count}}",t);return n.addSuffix?0<n.comparison?o.futureTense(r)+" kuluttua":r+" sitten":r}}};},function(e,t,n){var a=n(1);e.exports=function(){var t=["tammi","helmi","maalis","huhti","touko","kesä","heinä","elo","syys","loka","marras","joulu"],n=["tammikuu","helmikuu","maaliskuu","huhtikuu","toukokuu","kesäkuu","heinäkuu","elokuu","syyskuu","lokakuu","marraskuu","joulukuu"],o=["su","ma","ti","ke","to","pe","la"],r=["sunnuntai","maanantai","tiistai","keskiviikko","torstai","perjantai","lauantai"];function e(e){return e.getHours()<12?"AP":"IP"}var i={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return o[e.getDay()]},dddd:function(e){return r[e.getDay()]},A:e,a:e,aa:e};return ["M","D","DDD","d","Q","W"].forEach(function(n){i[n+"o"]=function(e,t){return t[n](e).toString()+"."};}),{formatters:i,formattingTokensRegExp:a(i)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"mas maliit sa isang segundo",other:"mas maliit sa {{count}} segundo"},xSeconds:{one:"1 segundo",other:"{{count}} segundo"},halfAMinute:"kalahating minuto",lessThanXMinutes:{one:"mas maliit sa isang minuto",other:"mas maliit sa {{count}} minuto"},xMinutes:{one:"1 minuto",other:"{{count}} minuto"},aboutXHours:{one:"mga 1 oras",other:"mga {{count}} oras"},xHours:{one:"1 oras",other:"{{count}} oras"},xDays:{one:"1 araw",other:"{{count}} araw"},aboutXMonths:{one:"mga 1 buwan",other:"mga {{count}} buwan"},xMonths:{one:"1 buwan",other:"{{count}} buwan"},aboutXYears:{one:"mga 1 taon",other:"mga {{count}} taon"},xYears:{one:"1 taon",other:"{{count}} taon"},overXYears:{one:"higit sa 1 taon",other:"higit sa {{count}} taon"},almostXYears:{one:"halos 1 taon",other:"halos {{count}} taon"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"sa loob ng "+o:o+" ang nakalipas":o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["Ene","Peb","Mar","Abr","May","Hun","Hul","Ago","Set","Okt","Nob","Dis"],n=["Enero","Pebrero","Marso","Abril","Mayo","Hunyo","Hulyo","Agosto","Setyembre","Oktubre","Nobyembre","Disyembre"],o=["Li","Lu","Ma","Mi","Hu","Bi","Sa"],r=["Lin","Lun","Mar","Miy","Huw","Biy","Sab"],i=["Linggo","Lunes","Martes","Miyerkules","Huwebes","Biyernes","Sabado"],a=["NU","NT","NH","NG"],s=["nu","nt","nh","ng"],u=["ng umaga","ng tanghali","ng hapon","ng gabi"],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 12<e.getHours()?e.getHours()%12<6?a[2]:a[3]:e.getHours()<12?a[0]:a[1]},a:function(e){return 12<e.getHours()?e.getHours()%12<6?s[2]:s[3]:e.getHours()<12?s[0]:s[1]},aa:function(e){return 12<e.getHours()?e.getHours()%12<6?u[2]:u[3]:e.getHours()<12?u[0]:u[1]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return "ika-"+t[n](e)};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"moins d’une seconde",other:"moins de {{count}} secondes"},xSeconds:{one:"1 seconde",other:"{{count}} secondes"},halfAMinute:"30 secondes",lessThanXMinutes:{one:"moins d’une minute",other:"moins de {{count}} minutes"},xMinutes:{one:"1 minute",other:"{{count}} minutes"},aboutXHours:{one:"environ 1 heure",other:"environ {{count}} heures"},xHours:{one:"1 heure",other:"{{count}} heures"},xDays:{one:"1 jour",other:"{{count}} jours"},aboutXMonths:{one:"environ 1 mois",other:"environ {{count}} mois"},xMonths:{one:"1 mois",other:"{{count}} mois"},aboutXYears:{one:"environ 1 an",other:"environ {{count}} ans"},xYears:{one:"1 an",other:"{{count}} ans"},overXYears:{one:"plus d’un an",other:"plus de {{count}} ans"},almostXYears:{one:"presqu’un an",other:"presque {{count}} ans"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"dans "+o:"il y a "+o:o}}};},function(e,t,n){var l=n(1);e.exports=function(){var t=["janv.","févr.","mars","avr.","mai","juin","juill.","août","sept.","oct.","nov.","déc."],n=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"],o=["di","lu","ma","me","je","ve","sa"],r=["dim.","lun.","mar.","mer.","jeu.","ven.","sam."],i=["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"],a=["AM","PM"],s=["am","pm"],u=["du matin","de l’après-midi","du soir"],c={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){var t=e.getHours();return t<=12?u[0]:t<=16?u[1]:u[2]},Wo:function(e,t){return 1===(n=t.W(e))?"1re":n+"e";var n;}};return ["M","D","DDD","d","Q"].forEach(function(o){c[o+"o"]=function(e,t){return 1===(n=t[o](e))?"1er":n+"e";var n;};}),["MMM","MMMM"].forEach(function(o){c["Do "+o]=function(e,t){var n=1===e.getDate()?"Do":"D";return (c[n]||t[n])(e,t)+" "+c[o](e)};}),{formatters:c,formattingTokensRegExp:l(c)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:{standalone:"manje od 1 sekunde",withPrepositionAgo:"manje od 1 sekunde",withPrepositionIn:"manje od 1 sekundu"},dual:"manje od {{count}} sekunde",other:"manje od {{count}} sekundi"},xSeconds:{one:{standalone:"1 sekunda",withPrepositionAgo:"1 sekunde",withPrepositionIn:"1 sekundu"},dual:"{{count}} sekunde",other:"{{count}} sekundi"},halfAMinute:"pola minute",lessThanXMinutes:{one:{standalone:"manje od 1 minute",withPrepositionAgo:"manje od 1 minute",withPrepositionIn:"manje od 1 minutu"},dual:"manje od {{count}} minute",other:"manje od {{count}} minuta"},xMinutes:{one:{standalone:"1 minuta",withPrepositionAgo:"1 minute",withPrepositionIn:"1 minutu"},dual:"{{count}} minute",other:"{{count}} minuta"},aboutXHours:{one:{standalone:"oko 1 sat",withPrepositionAgo:"oko 1 sat",withPrepositionIn:"oko 1 sat"},dual:"oko {{count}} sata",other:"oko {{count}} sati"},xHours:{one:{standalone:"1 sat",withPrepositionAgo:"1 sat",withPrepositionIn:"1 sat"},dual:"{{count}} sata",other:"{{count}} sati"},xDays:{one:{standalone:"1 dan",withPrepositionAgo:"1 dan",withPrepositionIn:"1 dan"},dual:"{{count}} dana",other:"{{count}} dana"},aboutXMonths:{one:{standalone:"oko 1 mjesec",withPrepositionAgo:"oko 1 mjesec",withPrepositionIn:"oko 1 mjesec"},dual:"oko {{count}} mjeseca",other:"oko {{count}} mjeseci"},xMonths:{one:{standalone:"1 mjesec",withPrepositionAgo:"1 mjesec",withPrepositionIn:"1 mjesec"},dual:"{{count}} mjeseca",other:"{{count}} mjeseci"},aboutXYears:{one:{standalone:"oko 1 godinu",withPrepositionAgo:"oko 1 godinu",withPrepositionIn:"oko 1 godinu"},dual:"oko {{count}} godine",other:"oko {{count}} godina"},xYears:{one:{standalone:"1 godina",withPrepositionAgo:"1 godine",withPrepositionIn:"1 godinu"},dual:"{{count}} godine",other:"{{count}} godina"},overXYears:{one:{standalone:"preko 1 godinu",withPrepositionAgo:"preko 1 godinu",withPrepositionIn:"preko 1 godinu"},dual:"preko {{count}} godine",other:"preko {{count}} godina"},almostXYears:{one:{standalone:"gotovo 1 godinu",withPrepositionAgo:"gotovo 1 godinu",withPrepositionIn:"gotovo 1 godinu"},dual:"gotovo {{count}} godine",other:"gotovo {{count}} godina"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?n.addSuffix?0<n.comparison?r[e].one.withPrepositionIn:r[e].one.withPrepositionAgo:r[e].one.standalone:1<t%10&&t%10<5&&"1"!==String(t).substr(-2,1)?r[e].dual.replace("{{count}}",t):r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"za "+o:"prije "+o:o}}};},function(e,t,n){var d=n(1);e.exports=function(){var t=["sij","velj","ožu","tra","svi","lip","srp","kol","ruj","lis","stu","pro"],n=["siječanj","veljača","ožujak","travanj","svibanj","lipanj","srpanj","kolovoz","rujan","listopad","studeni","prosinac"],o=["siječnja","veljače","ožujka","travnja","svibnja","lipnja","srpnja","kolovoza","rujna","listopada","studenog","prosinca"],r=["ne","po","ut","sr","če","pe","su"],i=["ned","pon","uto","sri","čet","pet","sub"],a=["nedjelja","ponedjeljak","utorak","srijeda","četvrtak","petak","subota"],s=["ujutro","popodne"],u=["ujutro","popodne"],c=["ujutro","popodne"],l={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return r[e.getDay()]},ddd:function(e){return i[e.getDay()]},dddd:function(e){return a[e.getDay()]},A:function(e){return 1<=e.getHours()/12?s[1]:s[0]},a:function(e){return 1<=e.getHours()/12?u[1]:u[0]},aa:function(e){return 1<=e.getHours()/12?c[1]:c[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){l[n+"o"]=function(e,t){return t[n](e)+"."};}),["D","Do","DD"].forEach(function(n){l[n+" MMM"]=function(e,t){return (l[n]||t[n])(e,t)+" "+o[e.getMonth()]};}),{formatters:l,formattingTokensRegExp:d(l)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"kevesebb, mint egy másodperce",other:"kevesebb, mint {{count}} másodperce"},xSeconds:{one:"1 másodperce",other:"{{count}} másodperce"},halfAMinute:"fél perce",lessThanXMinutes:{one:"kevesebb, mint egy perce",other:"kevesebb, mint {{count}} perce"},xMinutes:{one:"1 perce",other:"{{count}} perce"},aboutXHours:{one:"közel 1 órája",other:"közel {{count}} órája"},xHours:{one:"1 órája",other:"{{count}} órája"},xDays:{one:"1 napja",other:"{{count}} napja"},aboutXMonths:{one:"közel 1 hónapja",other:"közel {{count}} hónapja"},xMonths:{one:"1 hónapja",other:"{{count}} hónapja"},aboutXYears:{one:"közel 1 éve",other:"közel {{count}} éve"},xYears:{one:"1 éve",other:"{{count}} éve"},overXYears:{one:"több, mint 1 éve",other:"több, mint {{count}} éve"},almostXYears:{one:"majdnem 1 éve",other:"majdnem {{count}} éve"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?""+o:o+"":o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["Jan","Feb","Már","Ápr","Máj","Jún","Júl","Aug","Sze","Okt","Nov","Dec"],n=["Január","Február","Március","Április","Május","Június","Július","Augusztus","Szeptember","Október","November","December"],o=["Va","Hé","Ke","Sze","Cs","Pé","Szo"],r=["Vas","Hét","Ked","Sze","Csü","Pén","Szo"],i=["Vasárnap","Hétfő","Kedd","Szerda","Csütörtök","Péntek","Szombat"],a=["DE","DU"],s=["de","du"],u=["délelőtt","délután"],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return function(e){var t=e%100;if(20<t||t<10)switch(t%10){case 1:return e+"st";case 2:return e+"nd";case 3:return e+"rd"}return e+"th"}(t[n](e))};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"kurang dari 1 detik",other:"kurang dari {{count}} detik"},xSeconds:{one:"1 detik",other:"{{count}} detik"},halfAMinute:"setengah menit",lessThanXMinutes:{one:"kurang dari 1 menit",other:"kurang dari {{count}} menit"},xMinutes:{one:"1 menit",other:"{{count}} menit"},aboutXHours:{one:"sekitar 1 jam",other:"sekitar {{count}} jam"},xHours:{one:"1 jam",other:"{{count}} jam"},xDays:{one:"1 hari",other:"{{count}} hari"},aboutXMonths:{one:"sekitar 1 bulan",other:"sekitar {{count}} bulan"},xMonths:{one:"1 bulan",other:"{{count}} bulan"},aboutXYears:{one:"sekitar 1 tahun",other:"sekitar {{count}} tahun"},xYears:{one:"1 tahun",other:"{{count}} tahun"},overXYears:{one:"lebih dari 1 tahun",other:"lebih dari {{count}} tahun"},almostXYears:{one:"hampir 1 tahun",other:"hampir {{count}} tahun"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"dalam waktu "+o:o+" yang lalu":o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"],n=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"],o=["Mi","Sn","Sl","Ra","Ka","Ju","Sa"],r=["Min","Sen","Sel","Rab","Kam","Jum","Sab"],i=["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"],a=["AM","PM"],s=["am","pm"],u=["a.m.","p.m."],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return function(e){switch(e){case 1:return "pertama";case 2:return "kedua";case 3:return "ketiga";default:return "ke-"+e}}(t[n](e))};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"minna en 1 sekúnda",other:"minna en {{count}} sekúndur"},xSeconds:{one:"1 sekúnda",other:"{{count}} sekúndur"},halfAMinute:"hálf mínúta",lessThanXMinutes:{one:"minna en 1 mínúta",other:"minna en {{count}} mínútur"},xMinutes:{one:"1 mínúta",other:"{{count}} mínútur"},aboutXHours:{one:"u.þ.b. 1 klukkustund",other:"u.þ.b. {{count}} klukkustundir"},xHours:{one:"1 klukkustund",other:"{{count}} klukkustundir"},xDays:{one:"1 dagur",other:"{{count}} dagar"},aboutXMonths:{one:"u.þ.b. 1 mánuður",other:"u.þ.b. {{count}} mánuðir"},xMonths:{one:"1 mánuður",other:"{{count}} mánuðir"},aboutXYears:{one:"u.þ.b. 1 ár",other:"u.þ.b. {{count}} ár"},xYears:{one:"1 ár",other:"{{count}} ár"},overXYears:{one:"meira en 1 ár",other:"meira en {{count}} ár"},almostXYears:{one:"næstum 1 ár",other:"næstum {{count}} ár"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"í "+o:o+" síðan":o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["jan","feb","mar","apr","maí","jún","júl","ágú","sep","okt","nóv","des"],n=["janúar","febrúar","mars","apríl","maí","júní","júlí","ágúst","september","október","nóvember","desember"],o=["su","má","þr","mi","fi","fö","la"],r=["sun","mán","þri","mið","fim","fös","lau"],i=["sunnudaginn","mánudaginn","þriðjudaginn","miðvikudaginn","fimmtudaginn","föstudaginn","laugardaginn"],a=["AM","PM"],s=["am","pm"],u=["a.m.","p.m."],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return ""+t[n](e)};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"meno di un secondo",other:"meno di {{count}} secondi"},xSeconds:{one:"un secondo",other:"{{count}} secondi"},halfAMinute:"alcuni secondi",lessThanXMinutes:{one:"meno di un minuto",other:"meno di {{count}} minuti"},xMinutes:{one:"un minuto",other:"{{count}} minuti"},aboutXHours:{one:"circa un'ora",other:"circa {{count}} ore"},xHours:{one:"un'ora",other:"{{count}} ore"},xDays:{one:"un giorno",other:"{{count}} giorni"},aboutXMonths:{one:"circa un mese",other:"circa {{count}} mesi"},xMonths:{one:"un mese",other:"{{count}} mesi"},aboutXYears:{one:"circa un anno",other:"circa {{count}} anni"},xYears:{one:"un anno",other:"{{count}} anni"},overXYears:{one:"più di un anno",other:"più di {{count}} anni"},almostXYears:{one:"quasi un anno",other:"quasi {{count}} anni"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"tra "+o:o+" fa":o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"],n=["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"],o=["do","lu","ma","me","gi","ve","sa"],r=["dom","lun","mar","mer","gio","ven","sab"],i=["domenica","lunedì","martedì","mercoledì","giovedì","venerdì","sabato"],a=["AM","PM"],s=["am","pm"],u=["a.m.","p.m."],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return t[n](e)+"º"};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"1秒以下",other:"{{count}}秒以下"},xSeconds:{one:"1秒",other:"{{count}}秒"},halfAMinute:"30秒ぐらい",lessThanXMinutes:{one:"1分以下",other:"{{count}}分以下"},xMinutes:{one:"1分",other:"{{count}}分"},aboutXHours:{one:"1時間ぐらい",other:"{{count}}時間ぐらい"},xHours:{one:"1時間",other:"{{count}}時間"},xDays:{one:"1日",other:"{{count}}日"},aboutXMonths:{one:"1ヶ月ぐらい",other:"{{count}}ヶ月ぐらい"},xMonths:{one:"1ヶ月",other:"{{count}}ヶ月"},aboutXYears:{one:"1年ぐらい",other:"{{count}}年ぐらい"},xYears:{one:"1年",other:"{{count}}年"},overXYears:{one:"1年以上",other:"{{count}}年以上"},almostXYears:{one:"1年以下",other:"{{count}}年以下"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?o+"後":o+"前":o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"],n=["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"],o=["日","月","火","水","木","金","土"],r=["日曜","月曜","火曜","水曜","木曜","金曜","土曜"],i=["日曜日","月曜日","火曜日","水曜日","木曜日","金曜日","土曜日"],a=["午前","午後"],s=["午前","午後"],u=["午前","午後"],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return t[n](e)+"日"};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"1초 미만",other:"{{count}}초 미만"},xSeconds:{one:"1초",other:"{{count}}초"},halfAMinute:"30초",lessThanXMinutes:{one:"1분 미만",other:"{{count}}분 미만"},xMinutes:{one:"1분",other:"{{count}}분"},aboutXHours:{one:"약 1시간",other:"약 {{count}}시간"},xHours:{one:"1시간",other:"{{count}}시간"},xDays:{one:"1일",other:"{{count}}일"},aboutXMonths:{one:"약 1개월",other:"약 {{count}}개월"},xMonths:{one:"1개월",other:"{{count}}개월"},aboutXYears:{one:"약 1년",other:"약 {{count}}년"},xYears:{one:"1년",other:"{{count}}년"},overXYears:{one:"1년 이상",other:"{{count}}년 이상"},almostXYears:{one:"거의 1년",other:"거의 {{count}}년"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?o+" 후":o+" 전":o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"],n=["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"],o=["일","월","화","수","목","금","토"],r=["일","월","화","수","목","금","토"],i=["일요일","월요일","화요일","수요일","목요일","금요일","토요일"],a=["오전","오후"],s=["오전","오후"],u=["오전","오후"],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return t[n](e)+"일"};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"помалку од секунда",other:"помалку од {{count}} секунди"},xSeconds:{one:"1 секунда",other:"{{count}} секунди"},halfAMinute:"половина минута",lessThanXMinutes:{one:"помалку од минута",other:"помалку од {{count}} минути"},xMinutes:{one:"1 минута",other:"{{count}} минути"},aboutXHours:{one:"околу 1 час",other:"околу {{count}} часа"},xHours:{one:"1 час",other:"{{count}} часа"},xDays:{one:"1 ден",other:"{{count}} дена"},aboutXMonths:{one:"околу 1 месец",other:"околу {{count}} месеци"},xMonths:{one:"1 месец",other:"{{count}} месеци"},aboutXYears:{one:"околу 1 година",other:"околу {{count}} години"},xYears:{one:"1 година",other:"{{count}} години"},overXYears:{one:"повеќе од 1 година",other:"повеќе од {{count}} години"},almostXYears:{one:"безмалку 1 година",other:"безмалку {{count}} години"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"за "+o:"пред "+o:o}}};},function(e,t,n){var s=n(1);e.exports=function(){var t=["јан","фев","мар","апр","мај","јун","јул","авг","сеп","окт","ное","дек"],n=["јануари","февруари","март","април","мај","јуни","јули","август","септември","октомври","ноември","декември"],o=["не","по","вт","ср","че","пе","са"],r=["нед","пон","вто","сре","чет","пет","саб"],i=["недела","понеделник","вторник","среда","четврток","петок","сабота"],a=["претпладне","попладне"],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?a[1]:a[0]},aa:function(e){return 1<=e.getHours()/12?a[1]:a[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return function(e){var t=e%100;if(20<t||t<10)switch(t%10){case 1:return e+"-ви";case 2:return e+"-ри";case 7:case 8:return e+"-ми"}return e+"-ти"}(t[n](e))};}),{formatters:e,formattingTokensRegExp:s(e)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"mindre enn ett sekund",other:"mindre enn {{count}} sekunder"},xSeconds:{one:"ett sekund",other:"{{count}} sekunder"},halfAMinute:"et halvt minutt",lessThanXMinutes:{one:"mindre enn ett minutt",other:"mindre enn {{count}} minutter"},xMinutes:{one:"ett minutt",other:"{{count}} minutter"},aboutXHours:{one:"rundt en time",other:"rundt {{count}} timer"},xHours:{one:"en time",other:"{{count}} timer"},xDays:{one:"en dag",other:"{{count}} dager"},aboutXMonths:{one:"rundt en måned",other:"rundt {{count}} måneder"},xMonths:{one:"en måned",other:"{{count}} måneder"},aboutXYears:{one:"rundt ett år",other:"rundt {{count}} år"},xYears:{one:"ett år",other:"{{count}} år"},overXYears:{one:"over ett år",other:"over {{count}} år"},almostXYears:{one:"nesten ett år",other:"nesten {{count}} år"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"om "+o:o+" siden":o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["jan.","feb.","mars","april","mai","juni","juli","aug.","sep.","okt.","nov.","des."],n=["januar","februar","mars","april","mai","juni","juli","august","september","oktober","november","desember"],o=["sø","ma","ti","on","to","fr","lø"],r=["sø.","ma.","ti.","on.","to.","fr.","lø."],i=["søndag","mandag","tirsdag","onsdag","torsdag","fredag","lørdag"],a=["AM","PM"],s=["am","pm"],u=["a.m.","p.m."],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return t[n](e)+"."};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"minder dan een seconde",other:"minder dan {{count}} seconden"},xSeconds:{one:"1 seconde",other:"{{count}} seconden"},halfAMinute:"een halve minuut",lessThanXMinutes:{one:"minder dan een minuut",other:"minder dan {{count}} minuten"},xMinutes:{one:"een minuut",other:"{{count}} minuten"},aboutXHours:{one:"ongeveer 1 uur",other:"ongeveer {{count}} uur"},xHours:{one:"1 uur",other:"{{count}} uur"},xDays:{one:"1 dag",other:"{{count}} dagen"},aboutXMonths:{one:"ongeveer 1 maand",other:"ongeveer {{count}} maanden"},xMonths:{one:"1 maand",other:"{{count}} maanden"},aboutXYears:{one:"ongeveer 1 jaar",other:"ongeveer {{count}} jaar"},xYears:{one:"1 jaar",other:"{{count}} jaar"},overXYears:{one:"meer dan 1 jaar",other:"meer dan {{count}} jaar"},almostXYears:{one:"bijna 1 jaar",other:"bijna {{count}} jaar"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"over "+o:o+" geleden":o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["jan","feb","mar","apr","mei","jun","jul","aug","sep","okt","nov","dec"],n=["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"],o=["zo","ma","di","wo","do","vr","za"],r=["zon","maa","din","woe","don","vri","zat"],i=["zondag","maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag"],a=["AM","PM"],s=["am","pm"],u=["a.m.","p.m."],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return t[n](e)+"e"};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){function i(e,t,n){n=n||"regular";var o=function(e,t){if(1===t)return e.one;var n=t%100;if(n<=20&&10<n)return e.other;var o=n%10;return 2<=o&&o<=4?e.twoFour:e.other}(e,t);return (o[n]||o).replace("{{count}}",t)}e.exports=function(){var r={lessThanXSeconds:{one:{regular:"mniej niż sekunda",past:"mniej niż sekundę",future:"mniej niż sekundę"},twoFour:"mniej niż {{count}} sekundy",other:"mniej niż {{count}} sekund"},xSeconds:{one:{regular:"sekunda",past:"sekundę",future:"sekundę"},twoFour:"{{count}} sekundy",other:"{{count}} sekund"},halfAMinute:{one:"pół minuty",twoFour:"pół minuty",other:"pół minuty"},lessThanXMinutes:{one:{regular:"mniej niż minuta",past:"mniej niż minutę",future:"mniej niż minutę"},twoFour:"mniej niż {{count}} minuty",other:"mniej niż {{count}} minut"},xMinutes:{one:{regular:"minuta",past:"minutę",future:"minutę"},twoFour:"{{count}} minuty",other:"{{count}} minut"},aboutXHours:{one:{regular:"około godzina",past:"około godziny",future:"około godzinę"},twoFour:"około {{count}} godziny",other:"około {{count}} godzin"},xHours:{one:{regular:"godzina",past:"godzinę",future:"godzinę"},twoFour:"{{count}} godziny",other:"{{count}} godzin"},xDays:{one:{regular:"dzień",past:"dzień",future:"1 dzień"},twoFour:"{{count}} dni",other:"{{count}} dni"},aboutXMonths:{one:"około miesiąc",twoFour:"około {{count}} miesiące",other:"około {{count}} miesięcy"},xMonths:{one:"miesiąc",twoFour:"{{count}} miesiące",other:"{{count}} miesięcy"},aboutXYears:{one:"około rok",twoFour:"około {{count}} lata",other:"około {{count}} lat"},xYears:{one:"rok",twoFour:"{{count}} lata",other:"{{count}} lat"},overXYears:{one:"ponad rok",twoFour:"ponad {{count}} lata",other:"ponad {{count}} lat"},almostXYears:{one:"prawie rok",twoFour:"prawie {{count}} lata",other:"prawie {{count}} lat"}};return {localize:function(e,t,n){var o=r[e];return (n=n||{}).addSuffix?0<n.comparison?"za "+i(o,t,"future"):i(o,t,"past")+" temu":i(o,t)}}};},function(e,t,n){var s=n(1);e.exports=function(){var t=["sty","lut","mar","kwi","maj","cze","lip","sie","wrz","paź","lis","gru"],n=["styczeń","luty","marzec","kwiecień","maj","czerwiec","lipiec","sierpień","wrzesień","październik","listopad","grudzień"],o=["nd","pn","wt","śr","cz","pt","sb"],r=["niedz.","pon.","wt.","śr.","czw.","piąt.","sob."],i=["niedziela","poniedziałek","wtorek","środa","czwartek","piątek","sobota"],a=["w nocy","rano","po południu","wieczorem"],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){var t=e.getHours();return 17<=t?a[3]:12<=t?a[2]:4<=t?a[1]:a[0]}};return e.a=e.A,e.aa=e.A,["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return t[n](e).toString()};}),{formatters:e,formattingTokensRegExp:s(e)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"menos de um segundo",other:"menos de {{count}} segundos"},xSeconds:{one:"1 segundo",other:"{{count}} segundos"},halfAMinute:"meio minuto",lessThanXMinutes:{one:"menos de um minuto",other:"menos de {{count}} minutos"},xMinutes:{one:"1 minuto",other:"{{count}} minutos"},aboutXHours:{one:"aproximadamente 1 hora",other:"aproximadamente {{count}} horas"},xHours:{one:"1 hora",other:"{{count}} horas"},xDays:{one:"1 dia",other:"{{count}} dias"},aboutXMonths:{one:"aproximadamente 1 mês",other:"aproximadamente {{count}} meses"},xMonths:{one:"1 mês",other:"{{count}} meses"},aboutXYears:{one:"aproximadamente 1 ano",other:"aproximadamente {{count}} anos"},xYears:{one:"1 ano",other:"{{count}} anos"},overXYears:{one:"mais de 1 ano",other:"mais de {{count}} anos"},almostXYears:{one:"quase 1 ano",other:"quase {{count}} anos"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"daqui a "+o:"há "+o:o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"],n=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"],o=["do","se","te","qa","qi","se","sa"],r=["dom","seg","ter","qua","qui","sex","sáb"],i=["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"],a=["AM","PM"],s=["am","pm"],u=["a.m.","p.m."],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return t[n](e)+"º"};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"mai puțin de o secundă",other:"mai puțin de {{count}} secunde"},xSeconds:{one:"1 secundă",other:"{{count}} secunde"},halfAMinute:"jumătate de minut",lessThanXMinutes:{one:"mai puțin de un minut",other:"mai puțin de {{count}} minute"},xMinutes:{one:"1 minut",other:"{{count}} minute"},aboutXHours:{one:"circa 1 oră",other:"circa {{count}} ore"},xHours:{one:"1 oră",other:"{{count}} ore"},xDays:{one:"1 zi",other:"{{count}} zile"},aboutXMonths:{one:"circa 1 lună",other:"circa {{count}} luni"},xMonths:{one:"1 lună",other:"{{count}} luni"},aboutXYears:{one:"circa 1 an",other:"circa {{count}} ani"},xYears:{one:"1 an",other:"{{count}} ani"},overXYears:{one:"peste 1 an",other:"peste {{count}} ani"},almostXYears:{one:"aproape 1 an",other:"aproape {{count}} ani"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"în "+o:o+" în urmă":o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["ian","feb","mar","apr","mai","iun","iul","aug","sep","oct","noi","dec"],n=["ianuarie","februarie","martie","aprilie","mai","iunie","iulie","august","septembrie","octombrie","noiembrie","decembrie"],o=["du","lu","ma","mi","jo","vi","sâ"],r=["dum","lun","mar","mie","joi","vin","sâm"],i=["duminică","luni","marți","miercuri","joi","vineri","sâmbăta"],a=["AM","PM"],s=["am","pm"],u=["a.m.","p.m."],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return t[n](e).toString()};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){function o(e,t){if(void 0!==e.one&&1===t)return e.one;var n=t%10,o=t%100;return 1===n&&11!==o?e.singularNominative.replace("{{count}}",t):2<=n&&n<=4&&(o<10||20<o)?e.singularGenitive.replace("{{count}}",t):e.pluralGenitive.replace("{{count}}",t)}function n(n){return function(e,t){return t.addSuffix?0<t.comparison?n.future?o(n.future,e):"через "+o(n.regular,e):n.past?o(n.past,e):o(n.regular,e)+" назад":o(n.regular,e)}}e.exports=function(){var o={lessThanXSeconds:n({regular:{one:"меньше секунды",singularNominative:"меньше {{count}} секунды",singularGenitive:"меньше {{count}} секунд",pluralGenitive:"меньше {{count}} секунд"},future:{one:"меньше, чем через секунду",singularNominative:"меньше, чем через {{count}} секунду",singularGenitive:"меньше, чем через {{count}} секунды",pluralGenitive:"меньше, чем через {{count}} секунд"}}),xSeconds:n({regular:{singularNominative:"{{count}} секунда",singularGenitive:"{{count}} секунды",pluralGenitive:"{{count}} секунд"},past:{singularNominative:"{{count}} секунду назад",singularGenitive:"{{count}} секунды назад",pluralGenitive:"{{count}} секунд назад"},future:{singularNominative:"через {{count}} секунду",singularGenitive:"через {{count}} секунды",pluralGenitive:"через {{count}} секунд"}}),halfAMinute:function(e,t){return t.addSuffix?0<t.comparison?"через полминуты":"полминуты назад":"полминуты"},lessThanXMinutes:n({regular:{one:"меньше минуты",singularNominative:"меньше {{count}} минуты",singularGenitive:"меньше {{count}} минут",pluralGenitive:"меньше {{count}} минут"},future:{one:"меньше, чем через минуту",singularNominative:"меньше, чем через {{count}} минуту",singularGenitive:"меньше, чем через {{count}} минуты",pluralGenitive:"меньше, чем через {{count}} минут"}}),xMinutes:n({regular:{singularNominative:"{{count}} минута",singularGenitive:"{{count}} минуты",pluralGenitive:"{{count}} минут"},past:{singularNominative:"{{count}} минуту назад",singularGenitive:"{{count}} минуты назад",pluralGenitive:"{{count}} минут назад"},future:{singularNominative:"через {{count}} минуту",singularGenitive:"через {{count}} минуты",pluralGenitive:"через {{count}} минут"}}),aboutXHours:n({regular:{singularNominative:"около {{count}} часа",singularGenitive:"около {{count}} часов",pluralGenitive:"около {{count}} часов"},future:{singularNominative:"приблизительно через {{count}} час",singularGenitive:"приблизительно через {{count}} часа",pluralGenitive:"приблизительно через {{count}} часов"}}),xHours:n({regular:{singularNominative:"{{count}} час",singularGenitive:"{{count}} часа",pluralGenitive:"{{count}} часов"}}),xDays:n({regular:{singularNominative:"{{count}} день",singularGenitive:"{{count}} дня",pluralGenitive:"{{count}} дней"}}),aboutXMonths:n({regular:{singularNominative:"около {{count}} месяца",singularGenitive:"около {{count}} месяцев",pluralGenitive:"около {{count}} месяцев"},future:{singularNominative:"приблизительно через {{count}} месяц",singularGenitive:"приблизительно через {{count}} месяца",pluralGenitive:"приблизительно через {{count}} месяцев"}}),xMonths:n({regular:{singularNominative:"{{count}} месяц",singularGenitive:"{{count}} месяца",pluralGenitive:"{{count}} месяцев"}}),aboutXYears:n({regular:{singularNominative:"около {{count}} года",singularGenitive:"около {{count}} лет",pluralGenitive:"около {{count}} лет"},future:{singularNominative:"приблизительно через {{count}} год",singularGenitive:"приблизительно через {{count}} года",pluralGenitive:"приблизительно через {{count}} лет"}}),xYears:n({regular:{singularNominative:"{{count}} год",singularGenitive:"{{count}} года",pluralGenitive:"{{count}} лет"}}),overXYears:n({regular:{singularNominative:"больше {{count}} года",singularGenitive:"больше {{count}} лет",pluralGenitive:"больше {{count}} лет"},future:{singularNominative:"больше, чем через {{count}} год",singularGenitive:"больше, чем через {{count}} года",pluralGenitive:"больше, чем через {{count}} лет"}}),almostXYears:n({regular:{singularNominative:"почти {{count}} год",singularGenitive:"почти {{count}} года",pluralGenitive:"почти {{count}} лет"},future:{singularNominative:"почти через {{count}} год",singularGenitive:"почти через {{count}} года",pluralGenitive:"почти через {{count}} лет"}})};return {localize:function(e,t,n){return n=n||{},o[e](t,n)}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["янв.","фев.","март","апр.","май","июнь","июль","авг.","сент.","окт.","нояб.","дек."],n=["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"],o=["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"],r=["вс","пн","вт","ср","чт","пт","сб"],i=["вск","пнд","втр","срд","чтв","птн","суб"],a=["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"],s=["ночи","утра","дня","вечера"],u={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return r[e.getDay()]},ddd:function(e){return i[e.getDay()]},dddd:function(e){return a[e.getDay()]},A:function(e){var t=e.getHours();return 17<=t?s[3]:12<=t?s[2]:4<=t?s[1]:s[0]},Do:function(e,t){return t.D(e)+"-е"},Wo:function(e,t){return t.W(e)+"-я"}};return u.a=u.A,u.aa=u.A,["M","DDD","d","Q"].forEach(function(n){u[n+"o"]=function(e,t){return t[n](e)+"-й"};}),["D","Do","DD"].forEach(function(n){u[n+" MMMM"]=function(e,t){return (u[n]||t[n])(e,t)+" "+o[e.getMonth()]};}),{formatters:u,formattingTokensRegExp:c(u)}};},function(e,t){function c(e,t,n){var o,r,i=(o=e,1===(r=t)?o.one:2<=r&&r<=4?o.twoFour:o.other);return (i[n]||i).replace("{{count}}",t)}function l(e){var t="";return "almost"===e&&(t="takmer"),"about"===e&&(t="približne"),0<t.length?t+" ":""}function d(e){var t="";return "lessThan"===e&&(t="menej než"),"over"===e&&(t="viac než"),0<t.length?t+" ":""}e.exports=function(){var u={xSeconds:{one:{regular:"sekunda",past:"sekundou",future:"sekundu"},twoFour:{regular:"{{count}} sekundy",past:"{{count}} sekundami",future:"{{count}} sekundy"},other:{regular:"{{count}} sekúnd",past:"{{count}} sekundami",future:"{{count}} sekúnd"}},halfAMinute:{other:{regular:"pol minúty",past:"pol minútou",future:"pol minúty"}},xMinutes:{one:{regular:"minúta",past:"minútou",future:"minútu"},twoFour:{regular:"{{count}} minúty",past:"{{count}} minútami",future:"{{count}} minúty"},other:{regular:"{{count}} minút",past:"{{count}} minútami",future:"{{count}} minút"}},xHours:{one:{regular:"hodina",past:"hodinou",future:"hodinu"},twoFour:{regular:"{{count}} hodiny",past:"{{count}} hodinami",future:"{{count}} hodiny"},other:{regular:"{{count}} hodín",past:"{{count}} hodinami",future:"{{count}} hodín"}},xDays:{one:{regular:"deň",past:"dňom",future:"deň"},twoFour:{regular:"{{count}} dni",past:"{{count}} dňami",future:"{{count}} dni"},other:{regular:"{{count}} dní",past:"{{count}} dňami",future:"{{count}} dní"}},xMonths:{one:{regular:"mesiac",past:"mesiacom",future:"mesiac"},twoFour:{regular:"{{count}} mesiace",past:"{{count}} mesiacmi",future:"{{count}} mesiace"},other:{regular:"{{count}} mesiacov",past:"{{count}} mesiacmi",future:"{{count}} mesiacov"}},xYears:{one:{regular:"rok",past:"rokom",future:"rok"},twoFour:{regular:"{{count}} roky",past:"{{count}} rokmi",future:"{{count}} roky"},other:{regular:"{{count}} rokov",past:"{{count}} rokmi",future:"{{count}} rokov"}}};return {localize:function(e,t,n){n=n||{};var o,r,i=(o=e,["lessThan","about","over","almost"].filter(function(e){return !!o.match(new RegExp("^"+e))})[0]||""),a=(r=e.substring(i.length)).charAt(0).toLowerCase()+r.slice(1),s=u[a];return n.addSuffix?0<n.comparison?l(i)+"za "+d(i)+c(s,t,"future"):l(i)+"pred "+d(i)+c(s,t,"past"):l(i)+d(i)+c(s,t,"regular")}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["jan","feb","mar","apr","máj","jún","júl","aug","sep","okt","nov","dec"],n=["január","február","marec","apríl","máj","jún","júl","august","september","október","november","december"],o=["ne","po","ut","st","št","pi","so"],r=["neď","pon","uto","str","štv","pia","sob"],i=["nedeľa","pondelok","utorok","streda","štvrtok","piatok","sobota"],a=["AM","PM"],s=["am","pm"],u=["a.m.","p.m."],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return t[n](e)+"."};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"manj kot sekunda",two:"manj kot 2 sekundi",three:"manj kot {{count}} sekunde",other:"manj kot {{count}} sekund"},xSeconds:{one:"1 sekunda",two:"2 sekundi",three:"{{count}} sekunde",other:"{{count}} sekund"},halfAMinute:"pol minute",lessThanXMinutes:{one:"manj kot minuta",two:"manj kot 2 minuti",three:"manj kot {{count}} minute",other:"manj kot {{count}} minut"},xMinutes:{one:"1 minuta",two:"2 minuti",three:"{{count}} minute",other:"{{count}} minut"},aboutXHours:{one:"približno 1 ura",two:"približno 2 uri",three:"približno {{count}} ure",other:"približno {{count}} ur"},xHours:{one:"1 ura",two:"2 uri",three:"{{count}} ure",other:"{{count}} ur"},xDays:{one:"1 dan",two:"2 dni",three:"{{count}} dni",other:"{{count}} dni"},aboutXMonths:{one:"približno 1 mesec",two:"približno 2 meseca",three:"približno {{count}} mesece",other:"približno {{count}} mesecev"},xMonths:{one:"1 mesec",two:"2 meseca",three:"{{count}} meseci",other:"{{count}} mesecev"},aboutXYears:{one:"približno 1 leto",two:"približno 2 leti",three:"približno {{count}} leta",other:"približno {{count}} let"},xYears:{one:"1 leto",two:"2 leti",three:"{{count}} leta",other:"{{count}} let"},overXYears:{one:"več kot 1 leto",two:"več kot 2 leti",three:"več kot {{count}} leta",other:"več kot {{count}} let"},almostXYears:{one:"skoraj 1 leto",two:"skoraj 2 leti",three:"skoraj {{count}} leta",other:"skoraj {{count}} let"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:2===t?r[e].two:3===t||4===t?r[e].three.replace("{{count}}",t):r[e].other.replace("{{count}}",t),n.addSuffix?(o=o.replace(/(minut|sekund|ur)(a)/,"$1o"),"xMonths"===e&&(o=o.replace(/(mesec)(i)/,"$1e")),0<n.comparison?"čez "+o:o+" nazaj"):o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["jan","feb","mar","apr","maj","jun","jul","avg","sep","okt","nov","dec"],n=["januar","februar","marec","april","maj","junij","julij","avgust","september","oktober","november","december"],o=["ne","po","to","sr","če","pe","so"],r=["ned","pon","tor","sre","čet","pet","sob"],i=["nedelja","ponedeljek","torek","sreda","četrtek","petek","sobota"],a=["AM","PM"],s=["am","pm"],u=["a.m.","p.m."],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return t[n](e)+"."};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){e.exports=function(){var i={lessThanXSeconds:{singular:"mindre än en sekund",plural:"mindre än {{count}} sekunder"},xSeconds:{singular:"en sekund",plural:"{{count}} sekunder"},halfAMinute:"en halv minut",lessThanXMinutes:{singular:"mindre än en minut",plural:"mindre än {{count}} minuter"},xMinutes:{singular:"en minut",plural:"{{count}} minuter"},aboutXHours:{singular:"ungefär en timme",plural:"ungefär {{count}} timmar"},xHours:{singular:"en timme",plural:"{{count}} timmar"},xDays:{singular:"en dag",plural:"{{count}} dagar"},aboutXMonths:{singular:"ungefär en månad",plural:"ungefär {{count}} månader"},xMonths:{singular:"en månad",plural:"{{count}} månader"},aboutXYears:{singular:"ungefär ett år",plural:"ungefär {{count}} år"},xYears:{singular:"ett år",plural:"{{count}} år"},overXYears:{singular:"över ett år",plural:"över {{count}} år"},almostXYears:{singular:"nästan ett år",plural:"nästan {{count}} år"}},a=["noll","en","två","tre","fyra","fem","sex","sju","åtta","nio","tio","elva","tolv"];return {localize:function(e,t,n){n=n||{};var o,r=i[e];return o="string"==typeof r?r:0===t||1<t?r.plural.replace("{{count}}",t<13?a[t]:t):r.singular,n.addSuffix?0<n.comparison?"om "+o:o+" sedan":o}}};},function(e,t,n){var s=n(1);e.exports=function(){var t=["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"],n=["januari","februari","mars","april","maj","juni","juli","augusti","september","oktober","november","december"],o=["sö","må","ti","on","to","fr","lö"],r=["sön","mån","tis","ons","tor","fre","lör"],i=["söndag","måndag","tisdag","onsdag","torsdag","fredag","lördag"],a=["f.m.","e.m."],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},aa:function(e){return 1<=e.getHours()/12?a[1]:a[0]}};return e.A=e.aa,e.a=e.aa,["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return function(e){var t=e%100;if(20<t||t<10)switch(t%10){case 1:case 2:return e+":a"}return e+":e"}(t[n](e))};}),{formatters:e,formattingTokensRegExp:s(e)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"น้อยกว่า 1 วินาที",other:"น้อยกว่า {{count}} วินาที"},xSeconds:{one:"1 วินาที",other:"{{count}} วินาที"},halfAMinute:"ครึ่งนาที",lessThanXMinutes:{one:"น้อยกว่า 1 นาที",other:"น้อยกว่า {{count}} นาที"},xMinutes:{one:"1 นาที",other:"{{count}} นาที"},aboutXHours:{one:"ประมาณ 1 ชั่วโมง",other:"ประมาณ {{count}} ชั่วโมง"},xHours:{one:"1 ชั่วโมง",other:"{{count}} ชั่วโมง"},xDays:{one:"1 วัน",other:"{{count}} วัน"},aboutXMonths:{one:"ประมาณ 1 เดือน",other:"ประมาณ {{count}} เดือน"},xMonths:{one:"1 เดือน",other:"{{count}} เดือน"},aboutXYears:{one:"ประมาณ 1 ปี",other:"ประมาณ {{count}} ปี"},xYears:{one:"1 ปี",other:"{{count}} ปี"},overXYears:{one:"มากกว่า 1 ปี",other:"มากกว่า {{count}} ปี"},almostXYears:{one:"เกือบ 1 ปี",other:"เกือบ {{count}} ปี"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?"halfAMinute"===e?"ใน"+o:"ใน "+o:o+"ที่ผ่านมา":o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."],n=["มกราคาม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"],o=["อา.","จ.","อ.","พ.","พฤ.","ศ.","ส."],r=["อา.","จ.","อ.","พ.","พฤ.","ศ.","ส."],i=["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"],a=["น."],s=["น."],u=["นาฬิกา"],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return a[0]},a:function(e){return s[0]},aa:function(e){return u[0]}};return {formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){e.exports=function(){var i={lessThanXSeconds:{one:"bir saniyeden az",other:"{{count}} saniyeden az"},xSeconds:{one:"1 saniye",other:"{{count}} saniye"},halfAMinute:"yarım dakika",lessThanXMinutes:{one:"bir dakikadan az",other:"{{count}} dakikadan az"},xMinutes:{one:"1 dakika",other:"{{count}} dakika"},aboutXHours:{one:"yaklaşık 1 saat",other:"yaklaşık {{count}} saat"},xHours:{one:"1 saat",other:"{{count}} saat"},xDays:{one:"1 gün",other:"{{count}} gün"},aboutXMonths:{one:"yaklaşık 1 ay",other:"yaklaşık {{count}} ay"},xMonths:{one:"1 ay",other:"{{count}} ay"},aboutXYears:{one:"yaklaşık 1 yıl",other:"yaklaşık {{count}} yıl"},xYears:{one:"1 yıl",other:"{{count}} yıl"},overXYears:{one:"1 yıldan fazla",other:"{{count}} yıldan fazla"},almostXYears:{one:"neredeyse 1 yıl",other:"neredeyse {{count}} yıl"}},a=["lessThanXSeconds","lessThanXMinutes","overXYears"];return {localize:function(e,t,n){var o;if(n=n||{},o="string"==typeof i[e]?i[e]:1===t?i[e].one:i[e].other.replace("{{count}}",t),n.addSuffix){var r="";return -1<a.indexOf(e)&&(r=" bir süre"),0<n.comparison?o+r+" içinde":o+r+" önce"}return o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"],n=["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"],o=["Pz","Pt","Sa","Ça","Pe","Cu","Ct"],r=["Paz","Pts","Sal","Çar","Per","Cum","Cts"],i=["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"],a=["ÖÖ","ÖS"],s=["öö","ös"],u=["ö.ö.","ö.s."],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return function(e){var t={1:"'inci",2:"'inci",3:"'üncü",4:"'üncü",5:"'inci",6:"'ıncı",7:"'inci",8:"'inci",9:"'uncu",10:"'uncu",20:"'inci",30:"'uncu",50:"'inci",60:"'ıncı",70:"'inci",80:"'inci",90:"'ıncı",100:"'üncü"};if(0===e)return "0'ıncı";var n=e%10,o=e%100-n,r=100<=e?100:null;return e+(t[n]||t[o]||t[r])}(t[n](e))};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"不到 1 秒",other:"不到 {{count}} 秒"},xSeconds:{one:"1 秒",other:"{{count}} 秒"},halfAMinute:"半分钟",lessThanXMinutes:{one:"不到 1 分钟",other:"不到 {{count}} 分钟"},xMinutes:{one:"1 分钟",other:"{{count}} 分钟"},xHours:{one:"1 小时",other:"{{count}} 小时"},aboutXHours:{one:"大约 1 小时",other:"大约 {{count}} 小时"},xDays:{one:"1 天",other:"{{count}} 天"},aboutXMonths:{one:"大约 1 个月",other:"大约 {{count}} 个月"},xMonths:{one:"1 个月",other:"{{count}} 个月"},aboutXYears:{one:"大约 1 年",other:"大约 {{count}} 年"},xYears:{one:"1 年",other:"{{count}} 年"},overXYears:{one:"超过 1 年",other:"超过 {{count}} 年"},almostXYears:{one:"将近 1 年",other:"将近 {{count}} 年"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?o+"内":o+"前":o}}};},function(e,t,n){var s=n(1);e.exports=function(){var t=["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"],n=["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"],o=["日","一","二","三","四","五","六"],r=["周日","周一","周二","周三","周四","周五","周六"],i=["星期日","星期一","星期二","星期三","星期四","星期五","星期六"],a=["上午","下午"],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]}};return e.a=e.aa=e.A=function(e){return 1<=e.getHours()/12?a[1]:a[0]},["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return t[n](e).toString()};}),{formatters:e,formattingTokensRegExp:s(e)}};},function(e,t){e.exports=function(){var r={lessThanXSeconds:{one:"少於 1 秒",other:"少於 {{count}} 秒"},xSeconds:{one:"1 秒",other:"{{count}} 秒"},halfAMinute:"半分鐘",lessThanXMinutes:{one:"少於 1 分鐘",other:"少於 {{count}} 分鐘"},xMinutes:{one:"1 分鐘",other:"{{count}} 分鐘"},xHours:{one:"1 小時",other:"{{count}} 小時"},aboutXHours:{one:"大約 1 小時",other:"大約 {{count}} 小時"},xDays:{one:"1 天",other:"{{count}} 天"},aboutXMonths:{one:"大約 1 個月",other:"大約 {{count}} 個月"},xMonths:{one:"1 個月",other:"{{count}} 個月"},aboutXYears:{one:"大約 1 年",other:"大約 {{count}} 年"},xYears:{one:"1 年",other:"{{count}} 年"},overXYears:{one:"超過 1 年",other:"超過 {{count}} 年"},almostXYears:{one:"將近 1 年",other:"將近 {{count}} 年"}};return {localize:function(e,t,n){var o;return n=n||{},o="string"==typeof r[e]?r[e]:1===t?r[e].one:r[e].other.replace("{{count}}",t),n.addSuffix?0<n.comparison?o+"內":o+"前":o}}};},function(e,t,n){var c=n(1);e.exports=function(){var t=["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"],n=["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"],o=["日","一","二","三","四","五","六"],r=["周日","周一","周二","周三","周四","周五","周六"],i=["星期日","星期一","星期二","星期三","星期四","星期五","星期六"],a=["AM","PM"],s=["am","pm"],u=["上午","下午"],e={MMM:function(e){return t[e.getMonth()]},MMMM:function(e){return n[e.getMonth()]},dd:function(e){return o[e.getDay()]},ddd:function(e){return r[e.getDay()]},dddd:function(e){return i[e.getDay()]},A:function(e){return 1<=e.getHours()/12?a[1]:a[0]},a:function(e){return 1<=e.getHours()/12?s[1]:s[0]},aa:function(e){return 1<=e.getHours()/12?u[1]:u[0]}};return ["M","D","DDD","d","Q","W"].forEach(function(n){e[n+"o"]=function(e,t){return t[n](e).toString()};}),{formatters:e,formattingTokensRegExp:c(e)}};},function(e,t,n){var a=n(0);e.exports=function(e,t){var n=t&&Number(t.weekStartsOn)||0,o=a(e),r=o.getDay(),i=(r<n?7:0)+r-n;return o.setDate(o.getDate()-i),o.setHours(0,0,0,0),o};},function(e,t,n){var a=n(4);e.exports=function(e,t){var n=a(e),o=a(t),r=n.getTime()-6e4*n.getTimezoneOffset(),i=o.getTime()-6e4*o.getTimezoneOffset();return Math.round((r-i)/864e5)};},function(e,t,n){var s=n(0),u=n(116);e.exports=function(e,t){var n=s(e),o=Number(t),r=n.getMonth()+o,i=new Date(0);i.setFullYear(n.getFullYear(),r,1),i.setHours(0,0,0,0);var a=u(i);return n.setMonth(r,Math.min(a,n.getDate())),n};},function(e,t,n){var r=n(0);e.exports=function(e,t){var n=r(e),o=r(t);return n.getTime()-o.getTime()};},function(e,t,n){var o=n(12),r=n(13);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(14),r=n(15);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(16),r=n(17);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(18),r=n(19);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(20),r=n(21);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(22),r=n(23);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(24),r=n(25);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(26),r=n(27);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(28),r=n(29);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(30),r=n(31);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(32),r=n(33);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(34),r=n(35);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(36),r=n(37);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(38),r=n(39);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(40),r=n(41);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(42),r=n(43);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(44),r=n(45);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(46),r=n(47);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(48),r=n(49);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(50),r=n(51);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(52),r=n(53);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(54),r=n(55);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(56),r=n(57);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(58),r=n(59);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(60),r=n(61);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(62),r=n(63);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(64),r=n(65);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(66),r=n(67);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(68),r=n(69);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(70),r=n(71);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(72),r=n(73);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(74),r=n(75);e.exports={distanceInWords:o(),format:r()};},function(e,t,n){var o=n(76),r=n(77);e.exports={distanceInWords:o(),format:r()};},function(e,t){e.exports=function(e){return e instanceof Date};},function(e,t,n){var i=n(0);e.exports=function(e){var t=i(e),n=t.getFullYear(),o=t.getMonth(),r=new Date(0);return r.setFullYear(n,o+1,0),r.setHours(0,0,0,0),r.getDate()};},function(e,t,n){var o=n(6);e.exports=function(e,t){var n=Number(t);return o(e,7*n)};},function(e,t,n){var r=n(0);e.exports=function(e,t){var n=r(e).getTime(),o=r(t).getTime();return o<n?-1:n<o?1:0};},function(e,t,n){var a=n(0),s=n(133),u=n(9);e.exports=function(e,t){var n=a(e),o=a(t),r=u(n,o),i=Math.abs(s(n,o));return n.setMonth(n.getMonth()-r*i),r*(i-(u(n,o)===-r))};},function(e,t,n){var o=n(81);e.exports=function(e,t){var n=o(e,t)/1e3;return 0<n?Math.floor(n):Math.ceil(n)};},function(e,t,n){var o=n(0);e.exports=function(e){var t=o(e);return t.setHours(23,59,59,999),t};},function(e,t,n){var o=n(0),r=n(3),i=n(8);e.exports=function(e){var t=o(e),n=r(t).getTime()-i(t).getTime();return Math.round(n/6048e5)+1};},function(e,t,n){var i=n(78);e.exports=function(e,t,n){var o=i(e,n),r=i(t,n);return o.getTime()===r.getTime()};},function(e,t,n){e.exports={addDays:n(6),addHours:n(125),addISOYears:n(126),addMilliseconds:n(7),addMinutes:n(128),addMonths:n(80),addQuarters:n(129),addSeconds:n(130),addWeeks:n(117),addYears:n(131),areRangesOverlapping:n(202),closestIndexTo:n(203),closestTo:n(204),compareAsc:n(9),compareDesc:n(118),differenceInCalendarDays:n(79),differenceInCalendarISOWeeks:n(205),differenceInCalendarISOYears:n(132),differenceInCalendarMonths:n(133),differenceInCalendarQuarters:n(206),differenceInCalendarWeeks:n(207),differenceInCalendarYears:n(135),differenceInDays:n(136),differenceInHours:n(208),differenceInISOYears:n(209),differenceInMilliseconds:n(81),differenceInMinutes:n(210),differenceInMonths:n(119),differenceInQuarters:n(211),differenceInSeconds:n(120),differenceInWeeks:n(212),differenceInYears:n(213),distanceInWords:n(138),distanceInWordsStrict:n(214),distanceInWordsToNow:n(215),eachDay:n(216),endOfDay:n(121),endOfHour:n(217),endOfISOWeek:n(218),endOfISOYear:n(219),endOfMinute:n(220),endOfMonth:n(140),endOfQuarter:n(221),endOfSecond:n(222),endOfToday:n(223),endOfTomorrow:n(224),endOfWeek:n(139),endOfYear:n(225),endOfYesterday:n(226),format:n(227),getDate:n(228),getDay:n(229),getDayOfYear:n(141),getDaysInMonth:n(116),getDaysInYear:n(230),getHours:n(231),getISODay:n(145),getISOWeek:n(122),getISOWeeksInYear:n(232),getISOYear:n(2),getMilliseconds:n(233),getMinutes:n(234),getMonth:n(235),getOverlappingDaysInRanges:n(236),getQuarter:n(134),getSeconds:n(237),getTime:n(238),getYear:n(239),isAfter:n(240),isBefore:n(241),isDate:n(115),isEqual:n(242),isFirstDayOfMonth:n(243),isFriday:n(244),isFuture:n(245),isLastDayOfMonth:n(246),isLeapYear:n(144),isMonday:n(247),isPast:n(248),isSameDay:n(249),isSameHour:n(146),isSameISOWeek:n(148),isSameISOYear:n(149),isSameMinute:n(150),isSameMonth:n(152),isSameQuarter:n(153),isSameSecond:n(155),isSameWeek:n(123),isSameYear:n(157),isSaturday:n(250),isSunday:n(251),isThisHour:n(252),isThisISOWeek:n(253),isThisISOYear:n(254),isThisMinute:n(255),isThisMonth:n(256),isThisQuarter:n(257),isThisSecond:n(258),isThisWeek:n(259),isThisYear:n(260),isThursday:n(261),isToday:n(262),isTomorrow:n(263),isTuesday:n(264),isValid:n(143),isWednesday:n(265),isWeekend:n(266),isWithinRange:n(267),isYesterday:n(268),lastDayOfISOWeek:n(269),lastDayOfISOYear:n(270),lastDayOfMonth:n(271),lastDayOfQuarter:n(272),lastDayOfWeek:n(158),lastDayOfYear:n(273),max:n(274),min:n(275),parse:n(0),setDate:n(276),setDay:n(277),setDayOfYear:n(278),setHours:n(279),setISODay:n(280),setISOWeek:n(281),setISOYear:n(127),setMilliseconds:n(282),setMinutes:n(283),setMonth:n(159),setQuarter:n(284),setSeconds:n(285),setYear:n(286),startOfDay:n(4),startOfHour:n(147),startOfISOWeek:n(3),startOfISOYear:n(8),startOfMinute:n(151),startOfMonth:n(287),startOfQuarter:n(154),startOfSecond:n(156),startOfToday:n(288),startOfTomorrow:n(289),startOfWeek:n(78),startOfYear:n(142),startOfYesterday:n(290),subDays:n(291),subHours:n(292),subISOYears:n(137),subMilliseconds:n(293),subMinutes:n(294),subMonths:n(295),subQuarters:n(296),subSeconds:n(297),subWeeks:n(298),subYears:n(299)};},function(e,t,n){var o=n(7);e.exports=function(e,t){var n=Number(t);return o(e,36e5*n)};},function(e,t,n){var o=n(2),r=n(127);e.exports=function(e,t){var n=Number(t);return r(e,o(e)+n)};},function(e,t,n){var a=n(0),s=n(8),u=n(79);e.exports=function(e,t){var n=a(e),o=Number(t),r=u(n,s(n)),i=new Date(0);return i.setFullYear(o,0,4),i.setHours(0,0,0,0),(n=s(i)).setDate(n.getDate()+r),n};},function(e,t,n){var o=n(7);e.exports=function(e,t){var n=Number(t);return o(e,6e4*n)};},function(e,t,n){var o=n(80);e.exports=function(e,t){var n=Number(t);return o(e,3*n)};},function(e,t,n){var o=n(7);e.exports=function(e,t){var n=Number(t);return o(e,1e3*n)};},function(e,t,n){var o=n(80);e.exports=function(e,t){var n=Number(t);return o(e,12*n)};},function(e,t,n){var o=n(2);e.exports=function(e,t){return o(e)-o(t)};},function(e,t,n){var r=n(0);e.exports=function(e,t){var n=r(e),o=r(t);return 12*(n.getFullYear()-o.getFullYear())+(n.getMonth()-o.getMonth())};},function(e,t,n){var o=n(0);e.exports=function(e){var t=o(e);return Math.floor(t.getMonth()/3)+1};},function(e,t,n){var r=n(0);e.exports=function(e,t){var n=r(e),o=r(t);return n.getFullYear()-o.getFullYear()};},function(e,t,n){var a=n(0),s=n(79),u=n(9);e.exports=function(e,t){var n=a(e),o=a(t),r=u(n,o),i=Math.abs(s(n,o));return n.setDate(n.getDate()-r*i),r*(i-(u(n,o)===-r))};},function(e,t,n){var o=n(126);e.exports=function(e,t){var n=Number(t);return o(e,-n)};},function(e,t,n){var v=n(118),g=n(0),_=n(120),y=n(119),b=n(5);e.exports=function(e,t,n){var o=n||{},r=v(e,t),i=o.locale,a=b.distanceInWords.localize;i&&i.distanceInWords&&i.distanceInWords.localize&&(a=i.distanceInWords.localize);var s,u,c={addSuffix:Boolean(o.addSuffix),comparison:r};0<r?(s=g(e),u=g(t)):(s=g(t),u=g(e));var l,d=_(u,s),f=u.getTimezoneOffset()-s.getTimezoneOffset(),h=Math.round(d/60)-f;if(h<2)return o.includeSeconds?d<5?a("lessThanXSeconds",5,c):d<10?a("lessThanXSeconds",10,c):d<20?a("lessThanXSeconds",20,c):d<40?a("halfAMinute",null,c):a(d<60?"lessThanXMinutes":"xMinutes",1,c):0===h?a("lessThanXMinutes",1,c):a("xMinutes",h,c);if(h<45)return a("xMinutes",h,c);if(h<90)return a("aboutXHours",1,c);if(h<1440)return a("aboutXHours",Math.round(h/60),c);if(h<2520)return a("xDays",1,c);if(h<43200)return a("xDays",Math.round(h/1440),c);if(h<86400)return a("aboutXMonths",l=Math.round(h/43200),c);if((l=y(u,s))<12)return a("xMonths",Math.round(h/43200),c);var m=l%12,p=Math.floor(l/12);return m<3?a("aboutXYears",p,c):m<9?a("overXYears",p,c):a("almostXYears",p+1,c)};},function(e,t,n){var a=n(0);e.exports=function(e,t){var n=t&&Number(t.weekStartsOn)||0,o=a(e),r=o.getDay(),i=6+(r<n?-7:0)-(r-n);return o.setDate(o.getDate()+i),o.setHours(23,59,59,999),o};},function(e,t,n){var o=n(0);e.exports=function(e){var t=o(e),n=t.getMonth();return t.setFullYear(t.getFullYear(),n+1,0),t.setHours(23,59,59,999),t};},function(e,t,n){var o=n(0),r=n(142),i=n(79);e.exports=function(e){var t=o(e);return i(t,r(t))+1};},function(e,t,n){var o=n(0);e.exports=function(e){var t=o(e),n=new Date(0);return n.setFullYear(t.getFullYear(),0,1),n.setHours(0,0,0,0),n};},function(e,t,n){var o=n(115);e.exports=function(e){if(o(e))return !isNaN(e);throw new TypeError(toString.call(e)+" is not an instance of Date")};},function(e,t,n){var o=n(0);e.exports=function(e){var t=o(e).getFullYear();return t%400==0||t%4==0&&t%100!=0};},function(e,t,n){var o=n(0);e.exports=function(e){var t=o(e).getDay();return 0===t&&(t=7),t};},function(e,t,n){var r=n(147);e.exports=function(e,t){var n=r(e),o=r(t);return n.getTime()===o.getTime()};},function(e,t,n){var o=n(0);e.exports=function(e){var t=o(e);return t.setMinutes(0,0,0),t};},function(e,t,n){var o=n(123);e.exports=function(e,t){return o(e,t,{weekStartsOn:1})};},function(e,t,n){var r=n(8);e.exports=function(e,t){var n=r(e),o=r(t);return n.getTime()===o.getTime()};},function(e,t,n){var r=n(151);e.exports=function(e,t){var n=r(e),o=r(t);return n.getTime()===o.getTime()};},function(e,t,n){var o=n(0);e.exports=function(e){var t=o(e);return t.setSeconds(0,0),t};},function(e,t,n){var r=n(0);e.exports=function(e,t){var n=r(e),o=r(t);return n.getFullYear()===o.getFullYear()&&n.getMonth()===o.getMonth()};},function(e,t,n){var r=n(154);e.exports=function(e,t){var n=r(e),o=r(t);return n.getTime()===o.getTime()};},function(e,t,n){var r=n(0);e.exports=function(e){var t=r(e),n=t.getMonth(),o=n-n%3;return t.setMonth(o,1),t.setHours(0,0,0,0),t};},function(e,t,n){var r=n(156);e.exports=function(e,t){var n=r(e),o=r(t);return n.getTime()===o.getTime()};},function(e,t,n){var o=n(0);e.exports=function(e){var t=o(e);return t.setMilliseconds(0),t};},function(e,t,n){var r=n(0);e.exports=function(e,t){var n=r(e),o=r(t);return n.getFullYear()===o.getFullYear()};},function(e,t,n){var a=n(0);e.exports=function(e,t){var n=t&&Number(t.weekStartsOn)||0,o=a(e),r=o.getDay(),i=6+(r<n?-7:0)-(r-n);return o.setHours(0,0,0,0),o.setDate(o.getDate()+i),o};},function(e,t,n){var u=n(0),c=n(116);e.exports=function(e,t){var n=u(e),o=Number(t),r=n.getFullYear(),i=n.getDate(),a=new Date(0);a.setFullYear(r,o,15),a.setHours(0,0,0,0);var s=c(a);return n.setMonth(o,Math.min(i,s)),n};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t){e.exports={typings:"../../typings.d.ts"};},function(e,t,n){Object.defineProperty(t,"__esModule",{value:!0});var o=n(197),r=n(199),i=n(305),a=n(308),s=n(311),u=n(314),c=n(317),l=n(320);t.default={bulmaAccordion:o.a,bulmaCalendar:r.a,bulmaCarousel:i.a,bulmaIconpicker:a.a,bulmaQuickview:s.a,bulmaSlider:u.a,bulmaSteps:c.a,bulmaTagsinput:l.a};},function(e,t,n){var r=n(198),i=function(){function o(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o);}}return function(e,t,n){return t&&o(e.prototype,t),n&&o(e,n),e}}();var a=Symbol("onBulmaAccordionClick"),o=function(e){function o(e){!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,o);var t=function(e,t){if(!e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return !t||"object"!=typeof t&&"function"!=typeof t?e:t}(this,(o.__proto__||Object.getPrototypeOf(o)).call(this));if(t.element="string"==typeof e?document.querySelector(e):e,!t.element)throw new Error("An invalid selector or non-DOM node has been provided.");return t._clickEvents=["click"],t[a]=t[a].bind(t),t.init(),t}return function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function, not "+typeof t);e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),t&&(Object.setPrototypeOf?Object.setPrototypeOf(e,t):e.__proto__=t);}(o,r["a"]),i(o,[{key:"init",value:function(){this.items=this.element.querySelectorAll(".accordion")||[],this._bindEvents();}},{key:"destroy",value:function(){var n=this;this.items.forEach(function(t){n._clickEvents.forEach(function(e){t.removeEventListener(e,n[a],!1);});});}},{key:"_bindEvents",value:function(){var n=this;this.items.forEach(function(t){n._clickEvents.forEach(function(e){t.addEventListener(e,n[a],!1);});});}},{key:a,value:function(e){e.preventDefault();var t=e.currentTarget.closest(".accordion")||e.currentTarget;if(t.classList.contains("is-active"))t.classList.remove("is-active");else {var n=this.element.querySelector(".accordion.is-active");n&&n.classList.remove("is-active"),t.classList.add("is-active");}}}],[{key:"attach",value:function(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:".accordions",t=new Array,n=document.querySelectorAll(e);return [].forEach.call(n,function(e){setTimeout(function(){t.push(new o(e));},100);}),t}}]),o}();t.a=o;},function(e,t,n){var o=function(){function o(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o);}}return function(e,t,n){return t&&o(e.prototype,t),n&&o(e,n),e}}();var r=function(){function t(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:[];!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,t),this._listeners=new Map(e),this._middlewares=new Map;}return o(t,[{key:"listenerCount",value:function(e){return this._listeners.has(e)?this._listeners.get(e).length:0}},{key:"removeListeners",value:function(){var t=this,e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null,n=1<arguments.length&&void 0!==arguments[1]&&arguments[1];null!==e?Array.isArray(e)?name.forEach(function(e){return t.removeListeners(e,n)}):(this._listeners.delete(e),n&&this.removeMiddleware(e)):this._listeners=new Map;}},{key:"middleware",value:function(e,t){var n=this;Array.isArray(e)?name.forEach(function(e){return n.middleware(e,t)}):(Array.isArray(this._middlewares.get(e))||this._middlewares.set(e,[]),this._middlewares.get(e).push(t));}},{key:"removeMiddleware",value:function(){var t=this,e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null;null!==e?Array.isArray(e)?name.forEach(function(e){return t.removeMiddleware(e)}):this._middlewares.delete(e):this._middlewares=new Map;}},{key:"on",value:function(e,t){var n=this,o=2<arguments.length&&void 0!==arguments[2]&&arguments[2];if(Array.isArray(e))e.forEach(function(e){return n.on(e,t)});else {var r=(e=e.toString()).split(/,|, | /);1<r.length?r.forEach(function(e){return n.on(e,t)}):(Array.isArray(this._listeners.get(e))||this._listeners.set(e,[]),this._listeners.get(e).push({once:o,callback:t}));}}},{key:"once",value:function(e,t){this.on(e,t,!0);}},{key:"emit",value:function(n,o){var r=this,i=2<arguments.length&&void 0!==arguments[2]&&arguments[2];n=n.toString();var a=this._listeners.get(n),s=null,u=0,c=i;if(Array.isArray(a))for(a.forEach(function(e,t){i||(s=r._middlewares.get(n),Array.isArray(s)?(s.forEach(function(e){e(o,function(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null;null!==e&&(o=e),u++;},n);}),u>=s.length&&(c=!0)):c=!0),c&&(e.once&&(a[t]=null),e.callback(o));});-1!==a.indexOf(null);)a.splice(a.indexOf(null),1);}}]),t}();t.a=r;},function(e,t,n){var o=n(200),u=n(201),c=n(124),i=(n.n(c),n(300)),a=n(301),s=n(302),l=n(303),d=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var o in n)Object.prototype.hasOwnProperty.call(n,o)&&(e[o]=n[o]);}return e},f=function(){function o(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o);}}return function(e,t,n){return t&&o(e.prototype,t),n&&o(e,n),e}}();var h=Symbol("onToggleDatePicker"),m=Symbol("onCloseDatePicker"),p=Symbol("onPreviousDatePicker"),v=Symbol("onNextDatePicker"),g=Symbol("onSelectMonthDatePicker"),_=Symbol("onMonthClickDatePicker"),y=Symbol("onSelectYearDatePicker"),b=Symbol("onYearClickDatePicker"),x=Symbol("onDateClickDatePicker"),M=Symbol("onDocumentClickDatePicker"),k=Symbol("onValidateClickDatePicker"),w=Symbol("onTodayClickDatePicker"),D=Symbol("onClearClickDatePicker"),S=Symbol("onCancelClickDatePicker"),j=!1;try{var r=Object.defineProperty({},"passive",{get:function(){j=!0;}});window.addEventListener("testPassive",null,r),window.removeEventListener("testPassive",null,r);}catch(e){}var E=function(e){function r(e){var t=1<arguments.length&&void 0!==arguments[1]?arguments[1]:{};!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,r);var n=function(e,t){if(!e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return !t||"object"!=typeof t&&"function"!=typeof t?e:t}(this,(r.__proto__||Object.getPrototypeOf(r)).call(this));if(n.element=u.a(e)?document.querySelector(e):e,!n.element)throw new Error("An invalid selector or non-DOM node has been provided.");return n._clickEvents=["click","touch"],n.options=d({},a.a,t),n[h]=n[h].bind(n),n[m]=n[m].bind(n),n[p]=n[p].bind(n),n[v]=n[v].bind(n),n[g]=n[g].bind(n),n[_]=n[_].bind(n),n[y]=n[y].bind(n),n[b]=n[b].bind(n),n[x]=n[x].bind(n),n[M]=n[M].bind(n),n[k]=n[k].bind(n),n[w]=n[w].bind(n),n[D]=n[D].bind(n),n[S]=n[S].bind(n),n._init(),n}return function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function, not "+typeof t);e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),t&&(Object.setPrototypeOf?Object.setPrototypeOf(e,t):e.__proto__=t);}(r,i["a"]),f(r,[{key:"isRange",value:function(){return this.options.isRange}},{key:"isOpen",value:function(){return this._open}},{key:"value",value:function(){if(!(0<arguments.length&&void 0!==arguments[0]?arguments[0]:null)){var e="";return this.options.isRange?this.startDate&&this._isValidDate(this.startDate)&&this.endDate&&this._isValidDate(this.endDate)&&(e=c.format(this.startDate,this.dateFormat,{locale:this.locale})+" - "+c.format(this.endDate,this.dateFormat,{locale:this.locale})):this.startDate&&this._isValidDate(this.startDate)&&(e=c.format(this.startDate,this._dateFormat,{locale:this.locale})),this.emit("date:selected",this.date,this),e}if(this.options.isRange){var t=this.element.value.split(" - ");t.length&&(this.startDate=new Date(t[0])),2===t.length&&(this.endDate=new Date(t[1]));}else this.startDate=new Date(this.element.value);}},{key:"clear",value:function(){this._clear();}},{key:"show",value:function(){this._snapshots=[],this._snapshot(),this.element.value&&this.value(this.element.value),this._visibleDate=this._isValidDate(this.startDate,this.minDate,this.maxDate)?this.startDate:this._visibleDate,this._refreshCalendar(),this._ui.body.dates.classList.add("is-active"),this._ui.body.months.classList.remove("is-active"),this._ui.body.years.classList.remove("is-active"),this._ui.navigation.previous.removeAttribute("disabled"),this._ui.navigation.next.removeAttribute("disabled"),this._ui.container.classList.add("is-active"),"default"===this.options.displayMode&&this._adjustPosition(),this._open=!0,this._focus=!0,this.emit("show",this);}},{key:"hide",value:function(){this._open=!1,this._focus=!1,this._ui.container.classList.remove("is-active"),this.emit("hide",this);}},{key:"destroy",value:function(){this._ui.container.remove();}},{key:M,value:function(e){j||e.preventDefault(),e.stopPropagation(),"inline"!==this.options.displayMode&&this._open&&this[m](e);}},{key:h,value:function(e){j||e.preventDefault(),e.stopPropagation(),this._open?this.hide():this.show();}},{key:k,value:function(e){j||e.preventDefault(),e.stopPropagation(),this[m](e);}},{key:w,value:function(e){j||e.preventDefault(),e.stopPropagation(),this.options.isRange?this._setStartAndEnd(new Date):this.startDate=new Date,this._visibleDate=this.startDate,this.element.value=this.value(),this._refreshCalendar();}},{key:D,value:function(e){j||e.preventDefault(),e.stopPropagation(),this._clear();}},{key:S,value:function(e){j||e.preventDefault(),e.stopPropagation(),this._snapshots.length&&(this.startDate=this._snapshots[0].start,this.endDate=this._snapshots[0].end),this.element.value=this.value(),this[m](e);}},{key:m,value:function(e){j||e.preventDefault(),e.stopPropagation(),this.hide();}},{key:p,value:function(e){j||e.preventDefault(),e.stopPropagation();var t=c.lastDayOfMonth(c.subMonths(new Date(c.getYear(this._visibleDate),c.getMonth(this._visibleDate)),1)),n=Math.min(c.getDaysInMonth(t),c.getDate(this._visibleDate));this._visibleDate=this.minDate?c.max(c.setDate(t,n),this.minDate):c.setDate(t,n),this._refreshCalendar();}},{key:v,value:function(e){j||e.preventDefault(),e.stopPropagation();var t=c.addMonths(this._visibleDate,1),n=Math.min(c.getDaysInMonth(t),c.getDate(this._visibleDate));this._visibleDate=this.maxDate?c.min(c.setDate(t,n),this.maxDate):c.setDate(t,n),this._refreshCalendar();}},{key:x,value:function(e){j||e.preventDefault(),e.stopPropagation(),e.currentTarget.classList.contains("is-disabled")||(this._setStartAndEnd(e.currentTarget.dataset.date),this._refreshCalendar(),("inline"===this.options.displayMode||this.options.closeOnSelect)&&(this.element.value=this.value()),(!this.options.isRange||this.startDate&&this._isValidDate(this.startDate)&&this.endDate&&this._isValidDate(this.endDate))&&this.options.closeOnSelect&&this.hide());}},{key:g,value:function(e){e.stopPropagation(),this._ui.body.dates.classList.remove("is-active"),this._ui.body.years.classList.remove("is-active"),this._ui.body.months.classList.add("is-active"),this._ui.navigation.previous.setAttribute("disabled","disabled"),this._ui.navigation.next.setAttribute("disabled","disabled");}},{key:y,value:function(e){e.stopPropagation(),this._ui.body.dates.classList.remove("is-active"),this._ui.body.months.classList.remove("is-active"),this._ui.body.years.classList.add("is-active"),this._ui.navigation.previous.setAttribute("disabled","disabled"),this._ui.navigation.next.setAttribute("disabled","disabled");var t=this._ui.body.years.querySelector(".calendar-year.is-active");t&&(this._ui.body.years.scrollTop=t.offsetTop-this._ui.body.years.offsetTop-this._ui.body.years.clientHeight/2);}},{key:_,value:function(e){j||e.preventDefault(),e.stopPropagation();var t=c.setMonth(this._visibleDate,parseInt(e.currentTarget.dataset.month)-1);this._visibleDate=this.minDate?c.max(t,this.minDate):t,this._visibleDate=this.maxDate?c.min(this._visibleDate,this.maxDate):this._visibleDate,this._refreshCalendar();}},{key:b,value:function(e){j||e.preventDefault(),e.stopPropagation();var t=c.setYear(this._visibleDate,parseInt(e.currentTarget.dataset.year));this._visibleDate=this.minDate?c.max(t,this.minDate):t,this._visibleDate=this.maxDate?c.min(this._visibleDate,this.maxDate):this._visibleDate,this._refreshCalendar();}},{key:"_init",value:function(){var i=this;this._id=o.a("datePicker"),this._snapshots=[],"date"===this.element.getAttribute("type").toLowerCase()&&this.element.setAttribute("type","text");var e=this.element.dataset?Object.keys(this.element.dataset).filter(function(e){return Object.keys(a.a).includes(e)}).reduce(function(e,t){return d({},e,(n={},o=t,r=i.element.dataset[t],o in n?Object.defineProperty(n,o,{value:r,enumerable:!0,configurable:!0,writable:!0}):n[o]=r,n));var n,o,r;},{}):{};return this.options=d({},this.options,e),this.lang=this.options.lang,this.dateFormat=this.options.dateFormat||"MM/DD/YYYY",this._date={start:void 0,end:void 0},this._open=!1,"inline"!==this.options.displayMode&&window.matchMedia("screen and (max-width: 768px)").matches&&(this.options.displayMode="dialog"),this._initDates(),this._build(),this._bindEvents(),this.emit("ready",this),this}},{key:"_initDates",value:function(){this.minDate=this.options.minDate,this.maxDate=this.options.maxDate;var e=new Date,t=this._isValidDate(e,this.options.minDate,this.options.maxDate)?e:this.options.minDate;if(this.startDate=this.options.startDate,this.endDate=this.options.isRange?this.options.endDate:void 0,this.element.value)if(this.options.isRange){var n=this.element.value.split(" - ");n.length&&(this.startDate=new Date(n[0])),2===n.length&&(this.endDate=new Date(n[1]));}else this.startDate=new Date(this.element.value);if(this._visibleDate=this._isValidDate(this.startDate)?this.startDate:t,this.options.disabledDates){Array.isArray(this.options.disabledDates)||(this.options.disabledDates=[this.options.disabledDates]);for(var o=0;o<this.options.disabledDates.length;o++)this.options.disabledDates[o]=c.format(this.options.disabledDates[o],this.options.dateFormat,{locale:this.locale});}this._snapshot();}},{key:"_build",value:function(){var n=this,e=new Array(7).fill(c.startOfWeek(this._visibleDate)).map(function(e,t){return c.format(c.addDays(e,t+n.options.weekStart),"ddd",{locale:n.locale})}),t=new Array(12).fill(c.startOfWeek(this._visibleDate)).map(function(e,t){return c.format(c.addMonths(e,t),"MM",{locale:n.locale})}),o=new Array(100).fill(c.subYears(this._visibleDate,50)).map(function(e,t){return c.format(c.addYears(e,t),"YYYY",{locale:n.locale})}),r=document.createRange().createContextualFragment(Object(s.a)(d({},this.options,{id:this.id,date:this.date,locale:this.locale,visibleDate:this._visibleDate,labels:{from:this.options.labelFrom,to:this.options.labelTo,weekdays:e},months:t,years:o,isRange:this.options.isRange,month:c.format(this.month,"MM",{locale:this.locale})}))),i=r.querySelector("#"+this.id);if(this._ui={container:i,calendar:i.querySelector(".calendar"),overlay:"dialog"===this.options.displayMode?{background:i.querySelector(".modal-background"),close:i.querySelector(".modal-close")}:void 0,header:{container:i.querySelector(".calendar-header"),start:{container:i.querySelector(".calendar-selection-start"),day:i.querySelector(".calendar-selection-start .calendar-selection-day"),month:i.querySelector(".calendar-selection-start .calendar-selection-month"),weekday:i.querySelector(".calendar-selection-start .calendar-selection-weekday"),empty:i.querySelector(".calendar-selection-start .empty")},end:this.options.isRange?{container:i.querySelector(".calendar-selection-end"),day:i.querySelector(".calendar-selection-end .calendar-selection-day"),month:i.querySelector(".calendar-selection-end .calendar-selection-month"),weekday:i.querySelector(".calendar-selection-end .calendar-selection-weekday"),empty:i.querySelector(".calendar-selection-start .empty")}:void 0},navigation:{container:i.querySelector(".calendar-nav"),previous:i.querySelector(".calendar-nav-previous"),next:i.querySelector(".calendar-nav-next"),month:i.querySelector(".calendar-nav-month"),year:i.querySelector(".calendar-nav-year")},footer:{container:i.querySelector(".calendar-footer"),validate:i.querySelector(".calendar-footer-validate"),today:i.querySelector(".calendar-footer-today"),clear:i.querySelector(".calendar-footer-clear"),cancel:i.querySelector(".calendar-footer-cancel")},body:{dates:i.querySelector(".calendar-dates"),days:i.querySelector(".calendar-days"),weekdays:i.querySelector(".calendar-weekdays"),months:i.querySelector(".calendar-months"),years:i.querySelector(".calendar-years")}},this.options.showHeader||this._ui.header.container.classList.add("is-hidden"),this.options.showFooter||this._ui.footer.container.classList.add("is-hidden"),this.options.todayButton||this._ui.footer.todayB.classList.add("is-hidden"),this.options.clearButton||this._ui.footer.clear.classList.add("is-hidden"),"inline"===this.options.displayMode&&this._ui.footer.validate&&this._ui.footer.validate.classList.add("is-hidden"),"inline"===this.options.displayMode&&this._ui.footer.cancel&&this._ui.footer.cancel.classList.add("is-hidden"),this.options.closeOnSelect&&this._ui.footer.validate&&this._ui.footer.validate.classList.add("is-hidden"),"inline"===this.options.displayMode){var a=document.createElement("div");this.element.parentNode.insertBefore(a,this.element),a.appendChild(this.element),this.element.classList.add("is-hidden"),a.appendChild(r),i.classList.remove("datepicker"),this._refreshCalendar();}else document.body.appendChild(r);}},{key:"_bindEvents",value:function(){var n=this;window.addEventListener("scroll",function(){"default"===n.options.displayMode&&(console("Scroll"),n._adjustPosition());}),document.addEventListener("keydown",function(e){if(n._focus)switch(e.keyCode||e.which){case 37:n[p](e);break;case 39:n[v](e);}}),!0===this.options.toggleOnInputClick&&this._clickEvents.forEach(function(e){n.element.addEventListener(e,n[h]);}),"dialog"===this.options.displayMode&&this._ui.overlay&&(this._ui.overlay.close&&this._clickEvents.forEach(function(e){n.this._ui.overlay.close.addEventListener(e,n[m]);}),this.options.closeOnOverlayClick&&this._ui.overlay.background&&this._clickEvents.forEach(function(e){n._ui.overlay.background.addEventListener(e,n[m]);})),this._ui.navigation.previous&&this._clickEvents.forEach(function(e){n._ui.navigation.previous.addEventListener(e,n[p]);}),this._ui.navigation.next&&this._clickEvents.forEach(function(e){n._ui.navigation.next.addEventListener(e,n[v]);}),this._ui.navigation.month&&this._clickEvents.forEach(function(e){n._ui.navigation.month.addEventListener(e,n[g]);}),this._ui.navigation.year&&this._clickEvents.forEach(function(e){n._ui.navigation.year.addEventListener(e,n[y]);}),(this._ui.body.months.querySelectorAll(".calendar-month")||[]).forEach(function(t){n._clickEvents.forEach(function(e){t.addEventListener(e,n[_]);});}),(this._ui.body.years.querySelectorAll(".calendar-year")||[]).forEach(function(t){n._clickEvents.forEach(function(e){t.addEventListener(e,n[b]);});}),this._ui.footer.validate&&this._clickEvents.forEach(function(e){n._ui.footer.validate.addEventListener(e,n[k]);}),this._ui.footer.today&&this._clickEvents.forEach(function(e){n._ui.footer.today.addEventListener(e,n[w]);}),this._ui.footer.clear&&this._clickEvents.forEach(function(e){n._ui.footer.clear.addEventListener(e,n[D]);}),this._ui.footer.cancel&&this._clickEvents.forEach(function(e){n._ui.footer.cancel.addEventListener(e,n[S]);});}},{key:"_bindDaysEvents",value:function(){var o=this;[].forEach.call(this._ui.days,function(n){o._clickEvents.forEach(function(e){var t=o._isValidDate(new Date(n.dataset.date),o.minDate,o.maxDate)?o[x]:null;n.addEventListener(e,t);}),n.addEventListener("hover",function(e){e.preventDEfault();});});}},{key:"_renderDays",value:function(){var s=this,e=c.startOfWeek(c.startOfMonth(this._visibleDate)),t=c.endOfWeek(c.endOfMonth(this._visibleDate)),n=new Array(c.differenceInDays(t,e)+1).fill(e).map(function(e,t){var n=c.addDays(e,t+s.options.weekStart),o=c.isSameMonth(s._visibleDate,n),r=s.options.isRange&&c.isWithinRange(n,s.startDate,s.endDate),i=!!s.maxDate&&c.isAfter(n,s.maxDate);if(i=s.minDate?c.isBefore(n,s.minDate):i,s.options.disabledDates)for(var a=0;a<s.options.disabledDates.length;a++)c.getTime(n)==c.getTime(s.options.disabledDates[a])&&(i=!0);s.options.disabledWeekDays&&(u.a(s.options.disabledWeekDays)?s.options.disabledWeekDays.split(","):s.options.disabledWeekDays).forEach(function(e){c.getDay(n)==e&&(i=!0);});return {date:n,isRange:s.options.isRange,isToday:c.isToday(n),isStartDate:c.isEqual(s.startDate,n),isEndDate:c.isEqual(s.endDate,n),isDisabled:i,isThisMonth:o,isInRange:r}});this._ui.body.days.appendChild(document.createRange().createContextualFragment(Object(l.a)(n))),this._ui.days=this._ui.body.days.querySelectorAll(".calendar-date"),this._bindDaysEvents(),this.emit("rendered",this);}},{key:"_togglePreviousButton",value:function(){!(0<arguments.length&&void 0!==arguments[0])||arguments[0]?this._ui.navigation.previous.removeAttribute("disabled"):this._ui.navigation.previous.setAttribute("disabled","disabled");}},{key:"_toggleNextButton",value:function(){!(0<arguments.length&&void 0!==arguments[0])||arguments[0]?this._ui.navigation.next.removeAttribute("disabled"):this._ui.navigation.next.setAttribute("disabled","disabled");}},{key:"_setStartAndEnd",value:function(e){var r=this;this._snapshot(),this.options.isRange&&(!this._isValidDate(this.startDate)||this._isValidDate(this.startDate)&&this._isValidDate(this.endDate))?(this.startDate=new Date(e),this.endDate=void 0,this.emit("startDate:selected",this.date,this)):this.options.isRange&&!this._isValidDate(this.endDate)?c.isBefore(e,this.startDate)?(this.endDate=this.startDate,this.startDate=new Date(e),this.emit("startDate:selected",this.date,this),this.emit("endDate:selected",this.date,this)):c.isAfter(e,this.startDate)?(this.endDate=new Date(e),this.emit("endDate:selected",this.date,this)):(this.startDate=new Date(e),this.endDate=void 0):(this.startDate=new Date(e),this.endDate=void 0),this.options.isRange&&this._isValidDate(this.startDate)&&this._isValidDate(this.endDate)&&new Array(c.differenceInDays(this.endDate,this.startDate)+1).fill(this.startDate).map(function(e,t){var n=c.addDays(e,t),o=r._ui.body.dates.querySelector('.calendar-date[data-date="'+n.toString()+'"]');o&&(c.isEqual(r.startDate,n)&&o.classList.add("calendar-range-start"),c.isEqual(r.endDate,n)&&o.classList.add("calendar-range-end"),o.classList.add("calendar-range"));});}},{key:"_clear",value:function(){this.startDate=void 0,this.endDate=void 0,this.element.value=this.value(),"inline"!==this.options.displayMode&&this._open&&this.hide(),this._refreshCalendar();}},{key:"_refreshCalendar",value:function(){var t=this;return this._ui.body.days.innerHTML="",this.minDate&&0===c.differenceInMonths(this._visibleDate,this.minDate)?this._togglePreviousButton(!1):this._togglePreviousButton(),this.maxDate&&0===c.differenceInMonths(this._visibleDate,this.maxDate)?this._toggleNextButton(!1):this._toggleNextButton(),this._refreshCalendarHeader(),this._ui.navigation.month.innerHTML=c.format(this._visibleDate,"MMMM",{locale:this.locale}),this._ui.navigation.year.innerHTML=c.format(this._visibleDate,"YYYY",{locale:this.locale}),(this._ui.body.months.querySelectorAll(".calendar-month")||[]).forEach(function(e){e.classList.remove("is-active"),e.dataset.month===c.format(t._visibleDate,"MM",{locale:t.locale})&&e.classList.add("is-active");}),(this._ui.body.years.querySelectorAll(".calendar-year")||[]).forEach(function(e){e.classList.remove("is-active"),e.dataset.year===c.format(t._visibleDate,"YYYY",{locale:t.locale})&&e.classList.add("is-active");}),this._renderDays(),this._ui.body.dates.classList.add("is-active"),this._ui.body.months.classList.remove("is-active"),this._ui.body.years.classList.remove("is-active"),this._ui.navigation.previous.removeAttribute("disabled"),this._ui.navigation.next.removeAttribute("disabled"),this}},{key:"_refreshCalendarHeader",value:function(){this._ui.header.start.day.innerHTML=this._isValidDate(this.startDate)?c.getDate(this.startDate):"&nbsp;",this._ui.header.start.weekday.innerHTML=this._isValidDate(this.startDate)?c.format(this.startDate,"dddd",{locale:this.locale}):"&nbsp;",this._ui.header.start.month.innerHTML=this._isValidDate(this.startDate)?c.format(this.startDate,"MMMM YYYY",{locale:this.locale}):"&nbsp;",this._ui.header.end&&(this._ui.header.end.day.innerHTML=this.options.isRange&&this._isValidDate(this.endDate)?c.getDate(this.endDate):"&nbsp;",this._ui.header.end.weekday.innerHTML=this.options.isRange&&this._isValidDate(this.endDate)?c.format(this.endDate,"dddd",{locale:this.locale}):"&nbsp;",this._ui.header.end.month.innerHTML=this.options.isRange&&this._isValidDate(this.endDate)?c.format(this.endDate,"MMMM YYYY",{locale:this.locale}):"&nbsp;");}},{key:"_adjustPosition",value:function(){var e=void 0,t=void 0,n=void 0;if("function"==typeof this.element.getBoundingClientRect)e=(n=this.element.getBoundingClientRect()).left+window.pageXOffset,t=n.bottom+window.pageYOffset;else for(e=this.element.offsetLeft,t=this.element.offsetTop+this.element.offsetHeight;this.element=this.element.offsetParent;)e+=this.element.offsetLeft,t+=this.element.offsetTop;this._ui.container.style.position="absolute",this._ui.container.style.left=e+"px",this._ui.container.style.top=t+"px";}},{key:"_isValidDate",value:function(e,t,n){try{return !!e&&(!!c.isValid(e)&&(!t&&!n||(t&&n?c.isWithinRange(e,t,n):n?c.isBefore(e,n)||c.isEqual(e,n):c.isAfter(e,t)||c.isEqual(e,t))))}catch(e){return !1}}},{key:"_snapshot",value:function(){this._snapshots.push(d({},this._date));}},{key:"id",get:function(){return this._id}},{key:"lang",get:function(){return this._lang},set:function(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:"en";this._lang=e,this._locale=n(304)("./"+e);}},{key:"locale",get:function(){return this._locale}},{key:"date",get:function(){return this._date||{start:void 0,end:void 0}}},{key:"startDate",get:function(){return this._date.start},set:function(e){this._date.start=e?this._isValidDate(e,this.minDate,this.maxDate)?c.startOfDay(e):this._date.start:void 0;}},{key:"endDate",get:function(){return this._date.end},set:function(e){this._date.end=e?this._isValidDate(e,this.minDate,this.maxDate)?c.startOfDay(e):this._date.end:void 0;}},{key:"minDate",get:function(){return this._minDate},set:function(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:void 0;return this._minDate=e?this._isValidDate(e)?c.startOfDay(e):this._minDate:void 0,this}},{key:"maxDate",get:function(){return this._maxDate},set:function(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null;return this._maxDate=e?this._isValidDate(e)?c.startOfDay(e):this._maxDate:void 0,this}},{key:"dateFormat",get:function(){return this._dateFormat},set:function(e){return this._dateFormat=e,this}}],[{key:"attach",value:function(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:'input[type="date"]',t=1<arguments.length&&void 0!==arguments[1]?arguments[1]:{},n=new Array,o=u.a(e)?document.querySelectorAll(e):Array.isArray(e)?e:[e];return [].forEach.call(o,function(e){n.push(new r(e,t));}),n}}]),r}();t.a=E;},function(e,t,n){n.d(t,"a",function(){return o});var o=function(){return (0<arguments.length&&void 0!==arguments[0]?arguments[0]:"")+([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,function(e){return (e^crypto.getRandomValues(new Uint8Array(1))[0]&15>>e/4).toString(16)})};},function(e,t,n){n.d(t,"a",function(){return r});var o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},r=function(e){return "string"==typeof e||!!e&&"object"===(void 0===e?"undefined":o(e))&&"[object String]"===Object.prototype.toString.call(e)};},function(e,t,n){var u=n(0);e.exports=function(e,t,n,o){var r=u(e).getTime(),i=u(t).getTime(),a=u(n).getTime(),s=u(o).getTime();if(i<r||s<a)throw new Error("The start of the range cannot be after the end of the range");return r<s&&a<i};},function(e,t,n){var s=n(0);e.exports=function(e,t){if(!(t instanceof Array))throw new TypeError(toString.call(t)+" is not an instance of Array");var r,i,a=s(e).getTime();return t.forEach(function(e,t){var n=s(e),o=Math.abs(a-n.getTime());(void 0===r||o<i)&&(r=t,i=o);}),r};},function(e,t,n){var a=n(0);e.exports=function(e,t){if(!(t instanceof Array))throw new TypeError(toString.call(t)+" is not an instance of Array");var o,r,i=a(e).getTime();return t.forEach(function(e){var t=a(e),n=Math.abs(i-t.getTime());(void 0===o||n<r)&&(o=t,r=n);}),o};},function(e,t,n){var a=n(3);e.exports=function(e,t){var n=a(e),o=a(t),r=n.getTime()-6e4*n.getTimezoneOffset(),i=o.getTime()-6e4*o.getTimezoneOffset();return Math.round((r-i)/6048e5)};},function(e,t,n){var r=n(134),i=n(0);e.exports=function(e,t){var n=i(e),o=i(t);return 4*(n.getFullYear()-o.getFullYear())+(r(n)-r(o))};},function(e,t,n){var s=n(78);e.exports=function(e,t,n){var o=s(e,n),r=s(t,n),i=o.getTime()-6e4*o.getTimezoneOffset(),a=r.getTime()-6e4*r.getTimezoneOffset();return Math.round((i-a)/6048e5)};},function(e,t,n){var o=n(81);e.exports=function(e,t){var n=o(e,t)/36e5;return 0<n?Math.floor(n):Math.ceil(n)};},function(e,t,n){var a=n(0),s=n(132),u=n(9),c=n(137);e.exports=function(e,t){var n=a(e),o=a(t),r=u(n,o),i=Math.abs(s(n,o));return n=c(n,r*i),r*(i-(u(n,o)===-r))};},function(e,t,n){var o=n(81);e.exports=function(e,t){var n=o(e,t)/6e4;return 0<n?Math.floor(n):Math.ceil(n)};},function(e,t,n){var o=n(119);e.exports=function(e,t){var n=o(e,t)/3;return 0<n?Math.floor(n):Math.ceil(n)};},function(e,t,n){var o=n(136);e.exports=function(e,t){var n=o(e,t)/7;return 0<n?Math.floor(n):Math.ceil(n)};},function(e,t,n){var a=n(0),s=n(135),u=n(9);e.exports=function(e,t){var n=a(e),o=a(t),r=u(n,o),i=Math.abs(s(n,o));return n.setFullYear(n.getFullYear()-r*i),r*(i-(u(n,o)===-r))};},function(e,t,n){var p=n(118),v=n(0),g=n(120),_=n(5);e.exports=function(e,t,n){var o=n||{},r=p(e,t),i=o.locale,a=_.distanceInWords.localize;i&&i.distanceInWords&&i.distanceInWords.localize&&(a=i.distanceInWords.localize);var s,u,c,l={addSuffix:Boolean(o.addSuffix),comparison:r};0<r?(s=v(e),u=v(t)):(s=v(t),u=v(e));var d=Math[o.partialMethod?String(o.partialMethod):"floor"],f=g(u,s),h=u.getTimezoneOffset()-s.getTimezoneOffset(),m=d(f/60)-h;if("s"===(c=o.unit?String(o.unit):m<1?"s":m<60?"m":m<1440?"h":m<43200?"d":m<525600?"M":"Y"))return a("xSeconds",f,l);if("m"===c)return a("xMinutes",m,l);if("h"===c)return a("xHours",d(m/60),l);if("d"===c)return a("xDays",d(m/1440),l);if("M"===c)return a("xMonths",d(m/43200),l);if("Y"===c)return a("xYears",d(m/525600),l);throw new Error("Unknown unit: "+c)};},function(e,t,n){var o=n(138);e.exports=function(e,t){return o(Date.now(),e,t)};},function(e,t,n){var u=n(0);e.exports=function(e,t,n){var o=u(e),r=void 0!==n?n:1,i=u(t).getTime();if(o.getTime()>i)throw new Error("The first date cannot be after the second date");var a=[],s=o;for(s.setHours(0,0,0,0);s.getTime()<=i;)a.push(u(s)),s.setDate(s.getDate()+r);return a};},function(e,t,n){var o=n(0);e.exports=function(e){var t=o(e);return t.setMinutes(59,59,999),t};},function(e,t,n){var o=n(139);e.exports=function(e){return o(e,{weekStartsOn:1})};},function(e,t,n){var r=n(2),i=n(3);e.exports=function(e){var t=r(e),n=new Date(0);n.setFullYear(t+1,0,4),n.setHours(0,0,0,0);var o=i(n);return o.setMilliseconds(o.getMilliseconds()-1),o};},function(e,t,n){var o=n(0);e.exports=function(e){var t=o(e);return t.setSeconds(59,999),t};},function(e,t,n){var r=n(0);e.exports=function(e){var t=r(e),n=t.getMonth(),o=n-n%3+3;return t.setMonth(o,0),t.setHours(23,59,59,999),t};},function(e,t,n){var o=n(0);e.exports=function(e){var t=o(e);return t.setMilliseconds(999),t};},function(e,t,n){var o=n(121);e.exports=function(){return o(new Date)};},function(e,t){e.exports=function(){var e=new Date,t=e.getFullYear(),n=e.getMonth(),o=e.getDate(),r=new Date(0);return r.setFullYear(t,n,o+1),r.setHours(23,59,59,999),r};},function(e,t,n){var o=n(0);e.exports=function(e){var t=o(e),n=t.getFullYear();return t.setFullYear(n+1,0,0),t.setHours(23,59,59,999),t};},function(e,t){e.exports=function(){var e=new Date,t=e.getFullYear(),n=e.getMonth(),o=e.getDate(),r=new Date(0);return r.setFullYear(t,n,o-1),r.setHours(23,59,59,999),r};},function(e,t,n){var o=n(141),r=n(122),i=n(2),u=n(0),c=n(143),l=n(5);var d={M:function(e){return e.getMonth()+1},MM:function(e){return s(e.getMonth()+1,2)},Q:function(e){return Math.ceil((e.getMonth()+1)/3)},D:function(e){return e.getDate()},DD:function(e){return s(e.getDate(),2)},DDD:function(e){return o(e)},DDDD:function(e){return s(o(e),3)},d:function(e){return e.getDay()},E:function(e){return e.getDay()||7},W:function(e){return r(e)},WW:function(e){return s(r(e),2)},YY:function(e){return s(e.getFullYear(),4).substr(2)},YYYY:function(e){return s(e.getFullYear(),4)},GG:function(e){return String(i(e)).substr(2)},GGGG:function(e){return i(e)},H:function(e){return e.getHours()},HH:function(e){return s(e.getHours(),2)},h:function(e){var t=e.getHours();return 0===t?12:12<t?t%12:t},hh:function(e){return s(d.h(e),2)},m:function(e){return e.getMinutes()},mm:function(e){return s(e.getMinutes(),2)},s:function(e){return e.getSeconds()},ss:function(e){return s(e.getSeconds(),2)},S:function(e){return Math.floor(e.getMilliseconds()/100)},SS:function(e){return s(Math.floor(e.getMilliseconds()/10),2)},SSS:function(e){return s(e.getMilliseconds(),3)},Z:function(e){return a(e.getTimezoneOffset(),":")},ZZ:function(e){return a(e.getTimezoneOffset())},X:function(e){return Math.floor(e.getTime()/1e3)},x:function(e){return e.getTime()}};function a(e,t){t=t||"";var n=0<e?"-":"+",o=Math.abs(e),r=o%60;return n+s(Math.floor(o/60),2)+t+s(r,2)}function s(e,t){for(var n=Math.abs(e).toString();n.length<t;)n="0"+n;return n}e.exports=function(e,t,n){var o=t?String(t):"YYYY-MM-DDTHH:mm:ss.SSSZ",r=(n||{}).locale,i=l.format.formatters,a=l.format.formattingTokensRegExp;r&&r.format&&r.format.formatters&&(i=r.format.formatters,r.format.formattingTokensRegExp&&(a=r.format.formattingTokensRegExp));var s=u(e);return c(s)?function(e,t,n){var o,r,i,a=e.match(n),s=a.length;for(o=0;o<s;o++)r=t[a[o]]||d[a[o]],a[o]=r||((i=a[o]).match(/\[[\s\S]/)?i.replace(/^\[|]$/g,""):i.replace(/\\/g,""));return function(e){for(var t="",n=0;n<s;n++)a[n]instanceof Function?t+=a[n](e,d):t+=a[n];return t}}(o,i,a)(s):"Invalid Date"};},function(e,t,n){var o=n(0);e.exports=function(e){return o(e).getDate()};},function(e,t,n){var o=n(0);e.exports=function(e){return o(e).getDay()};},function(e,t,n){var o=n(144);e.exports=function(e){return o(e)?366:365};},function(e,t,n){var o=n(0);e.exports=function(e){return o(e).getHours()};},function(e,t,n){var o=n(8),r=n(117);e.exports=function(e){var t=o(e),n=o(r(t,60)).valueOf()-t.valueOf();return Math.round(n/6048e5)};},function(e,t,n){var o=n(0);e.exports=function(e){return o(e).getMilliseconds()};},function(e,t,n){var o=n(0);e.exports=function(e){return o(e).getMinutes()};},function(e,t,n){var o=n(0);e.exports=function(e){return o(e).getMonth()};},function(e,t,n){var c=n(0);e.exports=function(e,t,n,o){var r=c(e).getTime(),i=c(t).getTime(),a=c(n).getTime(),s=c(o).getTime();if(i<r||s<a)throw new Error("The start of the range cannot be after the end of the range");if(!(r<s&&a<i))return 0;var u=(i<s?i:s)-(a<r?r:a);return Math.ceil(u/864e5)};},function(e,t,n){var o=n(0);e.exports=function(e){return o(e).getSeconds()};},function(e,t,n){var o=n(0);e.exports=function(e){return o(e).getTime()};},function(e,t,n){var o=n(0);e.exports=function(e){return o(e).getFullYear()};},function(e,t,n){var r=n(0);e.exports=function(e,t){var n=r(e),o=r(t);return n.getTime()>o.getTime()};},function(e,t,n){var r=n(0);e.exports=function(e,t){var n=r(e),o=r(t);return n.getTime()<o.getTime()};},function(e,t,n){var r=n(0);e.exports=function(e,t){var n=r(e),o=r(t);return n.getTime()===o.getTime()};},function(e,t,n){var o=n(0);e.exports=function(e){return 1===o(e).getDate()};},function(e,t,n){var o=n(0);e.exports=function(e){return 5===o(e).getDay()};},function(e,t,n){var o=n(0);e.exports=function(e){return o(e).getTime()>(new Date).getTime()};},function(e,t,n){var o=n(0),r=n(121),i=n(140);e.exports=function(e){var t=o(e);return r(t).getTime()===i(t).getTime()};},function(e,t,n){var o=n(0);e.exports=function(e){return 1===o(e).getDay()};},function(e,t,n){var o=n(0);e.exports=function(e){return o(e).getTime()<(new Date).getTime()};},function(e,t,n){var r=n(4);e.exports=function(e,t){var n=r(e),o=r(t);return n.getTime()===o.getTime()};},function(e,t,n){var o=n(0);e.exports=function(e){return 6===o(e).getDay()};},function(e,t,n){var o=n(0);e.exports=function(e){return 0===o(e).getDay()};},function(e,t,n){var o=n(146);e.exports=function(e){return o(new Date,e)};},function(e,t,n){var o=n(148);e.exports=function(e){return o(new Date,e)};},function(e,t,n){var o=n(149);e.exports=function(e){return o(new Date,e)};},function(e,t,n){var o=n(150);e.exports=function(e){return o(new Date,e)};},function(e,t,n){var o=n(152);e.exports=function(e){return o(new Date,e)};},function(e,t,n){var o=n(153);e.exports=function(e){return o(new Date,e)};},function(e,t,n){var o=n(155);e.exports=function(e){return o(new Date,e)};},function(e,t,n){var o=n(123);e.exports=function(e,t){return o(new Date,e,t)};},function(e,t,n){var o=n(157);e.exports=function(e){return o(new Date,e)};},function(e,t,n){var o=n(0);e.exports=function(e){return 4===o(e).getDay()};},function(e,t,n){var o=n(4);e.exports=function(e){return o(e).getTime()===o(new Date).getTime()};},function(e,t,n){var o=n(4);e.exports=function(e){var t=new Date;return t.setDate(t.getDate()+1),o(e).getTime()===o(t).getTime()};},function(e,t,n){var o=n(0);e.exports=function(e){return 2===o(e).getDay()};},function(e,t,n){var o=n(0);e.exports=function(e){return 3===o(e).getDay()};},function(e,t,n){var o=n(0);e.exports=function(e){var t=o(e).getDay();return 0===t||6===t};},function(e,t,n){var a=n(0);e.exports=function(e,t,n){var o=a(e).getTime(),r=a(t).getTime(),i=a(n).getTime();if(i<r)throw new Error("The start of the range cannot be after the end of the range");return r<=o&&o<=i};},function(e,t,n){var o=n(4);e.exports=function(e){var t=new Date;return t.setDate(t.getDate()-1),o(e).getTime()===o(t).getTime()};},function(e,t,n){var o=n(158);e.exports=function(e){return o(e,{weekStartsOn:1})};},function(e,t,n){var r=n(2),i=n(3);e.exports=function(e){var t=r(e),n=new Date(0);n.setFullYear(t+1,0,4),n.setHours(0,0,0,0);var o=i(n);return o.setDate(o.getDate()-1),o};},function(e,t,n){var o=n(0);e.exports=function(e){var t=o(e),n=t.getMonth();return t.setFullYear(t.getFullYear(),n+1,0),t.setHours(0,0,0,0),t};},function(e,t,n){var r=n(0);e.exports=function(e){var t=r(e),n=t.getMonth(),o=n-n%3+3;return t.setMonth(o,0),t.setHours(0,0,0,0),t};},function(e,t,n){var o=n(0);e.exports=function(e){var t=o(e),n=t.getFullYear();return t.setFullYear(n+1,0,0),t.setHours(0,0,0,0),t};},function(e,t,n){var o=n(0);e.exports=function(){var e=Array.prototype.slice.call(arguments).map(function(e){return o(e)}),t=Math.max.apply(null,e);return new Date(t)};},function(e,t,n){var o=n(0);e.exports=function(){var e=Array.prototype.slice.call(arguments).map(function(e){return o(e)}),t=Math.min.apply(null,e);return new Date(t)};},function(e,t,n){var r=n(0);e.exports=function(e,t){var n=r(e),o=Number(t);return n.setDate(o),n};},function(e,t,n){var s=n(0),u=n(6);e.exports=function(e,t,n){var o=n&&Number(n.weekStartsOn)||0,r=s(e),i=Number(t),a=r.getDay();return u(r,((i%7+7)%7<o?7:0)+i-a)};},function(e,t,n){var r=n(0);e.exports=function(e,t){var n=r(e),o=Number(t);return n.setMonth(0),n.setDate(o),n};},function(e,t,n){var r=n(0);e.exports=function(e,t){var n=r(e),o=Number(t);return n.setHours(o),n};},function(e,t,n){var i=n(0),a=n(6),s=n(145);e.exports=function(e,t){var n=i(e),o=Number(t),r=s(n);return a(n,o-r)};},function(e,t,n){var i=n(0),a=n(122);e.exports=function(e,t){var n=i(e),o=Number(t),r=a(n)-o;return n.setDate(n.getDate()-7*r),n};},function(e,t,n){var r=n(0);e.exports=function(e,t){var n=r(e),o=Number(t);return n.setMilliseconds(o),n};},function(e,t,n){var r=n(0);e.exports=function(e,t){var n=r(e),o=Number(t);return n.setMinutes(o),n};},function(e,t,n){var r=n(0),i=n(159);e.exports=function(e,t){var n=r(e),o=Number(t)-(Math.floor(n.getMonth()/3)+1);return i(n,n.getMonth()+3*o)};},function(e,t,n){var r=n(0);e.exports=function(e,t){var n=r(e),o=Number(t);return n.setSeconds(o),n};},function(e,t,n){var r=n(0);e.exports=function(e,t){var n=r(e),o=Number(t);return n.setFullYear(o),n};},function(e,t,n){var o=n(0);e.exports=function(e){var t=o(e);return t.setDate(1),t.setHours(0,0,0,0),t};},function(e,t,n){var o=n(4);e.exports=function(){return o(new Date)};},function(e,t){e.exports=function(){var e=new Date,t=e.getFullYear(),n=e.getMonth(),o=e.getDate(),r=new Date(0);return r.setFullYear(t,n,o+1),r.setHours(0,0,0,0),r};},function(e,t){e.exports=function(){var e=new Date,t=e.getFullYear(),n=e.getMonth(),o=e.getDate(),r=new Date(0);return r.setFullYear(t,n,o-1),r.setHours(0,0,0,0),r};},function(e,t,n){var o=n(6);e.exports=function(e,t){var n=Number(t);return o(e,-n)};},function(e,t,n){var o=n(125);e.exports=function(e,t){var n=Number(t);return o(e,-n)};},function(e,t,n){var o=n(7);e.exports=function(e,t){var n=Number(t);return o(e,-n)};},function(e,t,n){var o=n(128);e.exports=function(e,t){var n=Number(t);return o(e,-n)};},function(e,t,n){var o=n(80);e.exports=function(e,t){var n=Number(t);return o(e,-n)};},function(e,t,n){var o=n(129);e.exports=function(e,t){var n=Number(t);return o(e,-n)};},function(e,t,n){var o=n(130);e.exports=function(e,t){var n=Number(t);return o(e,-n)};},function(e,t,n){var o=n(117);e.exports=function(e,t){var n=Number(t);return o(e,-n)};},function(e,t,n){var o=n(131);e.exports=function(e,t){var n=Number(t);return o(e,-n)};},function(e,t,n){var o=function(){function o(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o);}}return function(e,t,n){return t&&o(e.prototype,t),n&&o(e,n),e}}();var r=function(){function t(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:[];!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,t),this._listeners=new Map(e),this._middlewares=new Map;}return o(t,[{key:"listenerCount",value:function(e){return this._listeners.has(e)?this._listeners.get(e).length:0}},{key:"removeListeners",value:function(){var t=this,e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null,n=1<arguments.length&&void 0!==arguments[1]&&arguments[1];null!==e?Array.isArray(e)?name.forEach(function(e){return t.removeListeners(e,n)}):(this._listeners.delete(e),n&&this.removeMiddleware(e)):this._listeners=new Map;}},{key:"middleware",value:function(e,t){var n=this;Array.isArray(e)?name.forEach(function(e){return n.middleware(e,t)}):(Array.isArray(this._middlewares.get(e))||this._middlewares.set(e,[]),this._middlewares.get(e).push(t));}},{key:"removeMiddleware",value:function(){var t=this,e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null;null!==e?Array.isArray(e)?name.forEach(function(e){return t.removeMiddleware(e)}):this._middlewares.delete(e):this._middlewares=new Map;}},{key:"on",value:function(e,t){var n=this,o=2<arguments.length&&void 0!==arguments[2]&&arguments[2];if(Array.isArray(e))e.forEach(function(e){return n.on(e,t)});else {var r=(e=e.toString()).split(/,|, | /);1<r.length?r.forEach(function(e){return n.on(e,t)}):(Array.isArray(this._listeners.get(e))||this._listeners.set(e,[]),this._listeners.get(e).push({once:o,callback:t}));}}},{key:"once",value:function(e,t){this.on(e,t,!0);}},{key:"emit",value:function(n,o){var r=this,i=2<arguments.length&&void 0!==arguments[2]&&arguments[2];n=n.toString();var a=this._listeners.get(n),s=null,u=0,c=i;if(Array.isArray(a))for(a.forEach(function(e,t){i||(s=r._middlewares.get(n),Array.isArray(s)?(s.forEach(function(e){e(o,function(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null;null!==e&&(o=e),u++;},n);}),u>=s.length&&(c=!0)):c=!0),c&&(e.once&&(a[t]=null),e.callback(o));});-1!==a.indexOf(null);)a.splice(a.indexOf(null),1);}}]),t}();t.a=r;},function(e,t,n){var o={startDate:void 0,endDate:void 0,minDate:null,maxDate:null,isRange:!1,disabledDates:[],disabledWeekDays:void 0,lang:"en",dateFormat:"MM/DD/YYYY",displayMode:"default",showHeader:!0,showFooter:!0,todayButton:!0,clearButton:!0,labelFrom:"",labelTo:"",weekStart:0,closeOnOverlayClick:!0,closeOnSelect:!0,toggleOnInputClick:!0,icons:{previous:'<svg viewBox="0 0 50 80" xml:space="preserve">\n      <polyline fill="none" stroke-width=".5em" stroke-linecap="round" stroke-linejoin="round" points="45.63,75.8 0.375,38.087 45.63,0.375 "/>\n    </svg>',next:'<svg viewBox="0 0 50 80" xml:space="preserve">\n      <polyline fill="none" stroke-width=".5em" stroke-linecap="round" stroke-linejoin="round" points="0.375,0.375 45.63,38.087 0.375,75.8 "/>\n    </svg>'}};t.a=o;},function(e,t,n){var o=n(124);n.n(o);t.a=function(n){return "<div id='"+n.id+"' class=\"datepicker "+("dialog"===n.displayMode?"modal":"")+'">\n    '+("dialog"===n.displayMode?'<div class="modal-background"></div>':"")+'\n    <div class="calendar">\n      <div class="calendar-header">\n        <div class="calendar-selection-start">\n          <div class="calendar-selection-from'+(""===n.labels.from?" is-hidden":"")+'">'+n.labels.from+'</div>\n          <div class="calendar-selection-date">\n            <div class="calendar-selection-day"></div>\n            <div class="calendar-selection-details">\n              <div class="calendar-selection-month"></div>\n              <div class="calendar-selection-weekday"></div>\n            </div>\n          </div>\n        </div>\n  '+(n.isRange?'<div class="calendar-selection-end">\n          <div class="calendar-selection-to'+(""===n.labels.to?" is-hidden":"")+'">'+n.labels.to+'</div>\n          <div class="calendar-selection-date">\n            <div class="calendar-selection-day"></div>\n            <div class="calendar-selection-details">\n              <div class="calendar-selection-month"></div>\n              <div class="calendar-selection-weekday"></div>\n            </div>\n          </div>\n        </div>':"")+'\n      </div>\n      <div class="calendar-nav">\n        <button class="calendar-nav-previous button is-small is-text">'+n.icons.previous+'</button>\n        <div class="calendar-nav-month-year">\n          <div class="calendar-nav-month">'+Object(o.format)(n.visibleDate,"MMMM",{locale:n.locale})+'</div>\n          &nbsp;\n          <div class="calendar-nav-year">'+Object(o.format)(n.visibleDate,"YYYY",{locale:n.locale})+'</div>\n        </div>\n        <button class="calendar-nav-next button is-small is-text">'+n.icons.next+'</button>\n      </div>\n      <div class="calendar-body">\n        <div class="calendar-dates is-active">\n          <div class="calendar-weekdays">\n            '+n.labels.weekdays.map(function(e){return '<div class="calendar-date">'+e+"</div>"}).join("")+'\n          </div>\n          <div class="calendar-days"></div>\n        </div>\n        <div class="calendar-months">\n          '+new Array(12).fill(new Date("01/01/1970")).map(function(e,t){return '<div class="calendar-month" data-month="'+Object(o.format)(Object(o.addMonths)(e,t),"MM",{locale:n.locale})+'">'+Object(o.format)(Object(o.addMonths)(e,t),"MMM",{locale:n.locale})+"</div>"}).join("")+'\n        </div>\n        <div class="calendar-years">\n          '+n.years.map(function(e){return '<div class="calendar-year'+(e===Object(o.getMonth)(n.visibleDate)?" is-active":"")+'" data-year="'+e+'"><span class="item">'+e+"</span></div>"}).join("")+'\n        </div>\n      </div>\n      <div class="calendar-footer">\n        <button class="calendar-footer-validate has-text-success button is-small is-text">'+(n.icons.validate?n.icons.validate:"")+' Validate</button>\n        <button class="calendar-footer-today has-text-warning button is-small is-text">'+(n.icons.today?n.icons.today:"")+' Today</button>\n        <button class="calendar-footer-clear has-text-danger button is-small is-text">'+(n.icons.clear?n.icons.clear:"")+' Clear</button>\n        <button class="calendar-footer-cancel button is-small is-text">'+(n.icons.cancel?n.icons.cancel:"")+" Cancel</button>\n      </div>\n    </div>\n  </div>"};},function(e,t,n){t.a=function(e){return ""+e.map(function(e){return '<div data-date="'+e.date.toString()+'" class="calendar-date'+(e.isThisMonth?" is-current-month":"")+(e.isDisabled?" is-disabled":"")+(e.isRange&&e.isInRange?" calendar-range":"")+(e.isStartDate?" calendar-range-start":"")+(e.isEndDate?" calendar-range-end":"")+'">\n      <button class="date-item'+(e.isToday?" is-today":"")+(e.isStartDate?" is-active":"")+'">'+e.date.getDate()+"</button>\n  </div>"}).join("")};},function(e,t,n){var o={"./_lib/build_formatting_tokens_reg_exp":1,"./_lib/build_formatting_tokens_reg_exp/":1,"./_lib/build_formatting_tokens_reg_exp/index":1,"./_lib/build_formatting_tokens_reg_exp/index.js":1,"./_lib/package":160,"./_lib/package.json":160,"./ar":82,"./ar/":82,"./ar/build_distance_in_words_locale":12,"./ar/build_distance_in_words_locale/":12,"./ar/build_distance_in_words_locale/index":12,"./ar/build_distance_in_words_locale/index.js":12,"./ar/build_format_locale":13,"./ar/build_format_locale/":13,"./ar/build_format_locale/index":13,"./ar/build_format_locale/index.js":13,"./ar/index":82,"./ar/index.js":82,"./ar/package":161,"./ar/package.json":161,"./bg":83,"./bg/":83,"./bg/build_distance_in_words_locale":14,"./bg/build_distance_in_words_locale/":14,"./bg/build_distance_in_words_locale/index":14,"./bg/build_distance_in_words_locale/index.js":14,"./bg/build_format_locale":15,"./bg/build_format_locale/":15,"./bg/build_format_locale/index":15,"./bg/build_format_locale/index.js":15,"./bg/index":83,"./bg/index.js":83,"./bg/package":162,"./bg/package.json":162,"./ca":84,"./ca/":84,"./ca/build_distance_in_words_locale":16,"./ca/build_distance_in_words_locale/":16,"./ca/build_distance_in_words_locale/index":16,"./ca/build_distance_in_words_locale/index.js":16,"./ca/build_format_locale":17,"./ca/build_format_locale/":17,"./ca/build_format_locale/index":17,"./ca/build_format_locale/index.js":17,"./ca/index":84,"./ca/index.js":84,"./ca/package":163,"./ca/package.json":163,"./cs":85,"./cs/":85,"./cs/build_distance_in_words_locale":18,"./cs/build_distance_in_words_locale/":18,"./cs/build_distance_in_words_locale/index":18,"./cs/build_distance_in_words_locale/index.js":18,"./cs/build_format_locale":19,"./cs/build_format_locale/":19,"./cs/build_format_locale/index":19,"./cs/build_format_locale/index.js":19,"./cs/index":85,"./cs/index.js":85,"./cs/package":164,"./cs/package.json":164,"./da":86,"./da/":86,"./da/build_distance_in_words_locale":20,"./da/build_distance_in_words_locale/":20,"./da/build_distance_in_words_locale/index":20,"./da/build_distance_in_words_locale/index.js":20,"./da/build_format_locale":21,"./da/build_format_locale/":21,"./da/build_format_locale/index":21,"./da/build_format_locale/index.js":21,"./da/index":86,"./da/index.js":86,"./da/package":165,"./da/package.json":165,"./de":87,"./de/":87,"./de/build_distance_in_words_locale":22,"./de/build_distance_in_words_locale/":22,"./de/build_distance_in_words_locale/index":22,"./de/build_distance_in_words_locale/index.js":22,"./de/build_format_locale":23,"./de/build_format_locale/":23,"./de/build_format_locale/index":23,"./de/build_format_locale/index.js":23,"./de/index":87,"./de/index.js":87,"./de/package":166,"./de/package.json":166,"./el":88,"./el/":88,"./el/build_distance_in_words_locale":24,"./el/build_distance_in_words_locale/":24,"./el/build_distance_in_words_locale/index":24,"./el/build_distance_in_words_locale/index.js":24,"./el/build_format_locale":25,"./el/build_format_locale/":25,"./el/build_format_locale/index":25,"./el/build_format_locale/index.js":25,"./el/index":88,"./el/index.js":88,"./el/package":167,"./el/package.json":167,"./en":5,"./en/":5,"./en/build_distance_in_words_locale":10,"./en/build_distance_in_words_locale/":10,"./en/build_distance_in_words_locale/index":10,"./en/build_distance_in_words_locale/index.js":10,"./en/build_format_locale":11,"./en/build_format_locale/":11,"./en/build_format_locale/index":11,"./en/build_format_locale/index.js":11,"./en/index":5,"./en/index.js":5,"./en/package":168,"./en/package.json":168,"./eo":89,"./eo/":89,"./eo/build_distance_in_words_locale":26,"./eo/build_distance_in_words_locale/":26,"./eo/build_distance_in_words_locale/index":26,"./eo/build_distance_in_words_locale/index.js":26,"./eo/build_format_locale":27,"./eo/build_format_locale/":27,"./eo/build_format_locale/index":27,"./eo/build_format_locale/index.js":27,"./eo/index":89,"./eo/index.js":89,"./eo/package":169,"./eo/package.json":169,"./es":90,"./es/":90,"./es/build_distance_in_words_locale":28,"./es/build_distance_in_words_locale/":28,"./es/build_distance_in_words_locale/index":28,"./es/build_distance_in_words_locale/index.js":28,"./es/build_format_locale":29,"./es/build_format_locale/":29,"./es/build_format_locale/index":29,"./es/build_format_locale/index.js":29,"./es/index":90,"./es/index.js":90,"./es/package":170,"./es/package.json":170,"./fi":91,"./fi/":91,"./fi/build_distance_in_words_locale":30,"./fi/build_distance_in_words_locale/":30,"./fi/build_distance_in_words_locale/index":30,"./fi/build_distance_in_words_locale/index.js":30,"./fi/build_format_locale":31,"./fi/build_format_locale/":31,"./fi/build_format_locale/index":31,"./fi/build_format_locale/index.js":31,"./fi/index":91,"./fi/index.js":91,"./fi/package":171,"./fi/package.json":171,"./fil":92,"./fil/":92,"./fil/build_distance_in_words_locale":32,"./fil/build_distance_in_words_locale/":32,"./fil/build_distance_in_words_locale/index":32,"./fil/build_distance_in_words_locale/index.js":32,"./fil/build_format_locale":33,"./fil/build_format_locale/":33,"./fil/build_format_locale/index":33,"./fil/build_format_locale/index.js":33,"./fil/index":92,"./fil/index.js":92,"./fil/package":172,"./fil/package.json":172,"./fr":93,"./fr/":93,"./fr/build_distance_in_words_locale":34,"./fr/build_distance_in_words_locale/":34,"./fr/build_distance_in_words_locale/index":34,"./fr/build_distance_in_words_locale/index.js":34,"./fr/build_format_locale":35,"./fr/build_format_locale/":35,"./fr/build_format_locale/index":35,"./fr/build_format_locale/index.js":35,"./fr/index":93,"./fr/index.js":93,"./fr/package":173,"./fr/package.json":173,"./hr":94,"./hr/":94,"./hr/build_distance_in_words_locale":36,"./hr/build_distance_in_words_locale/":36,"./hr/build_distance_in_words_locale/index":36,"./hr/build_distance_in_words_locale/index.js":36,"./hr/build_format_locale":37,"./hr/build_format_locale/":37,"./hr/build_format_locale/index":37,"./hr/build_format_locale/index.js":37,"./hr/index":94,"./hr/index.js":94,"./hr/package":174,"./hr/package.json":174,"./hu":95,"./hu/":95,"./hu/build_distance_in_words_locale":38,"./hu/build_distance_in_words_locale/":38,"./hu/build_distance_in_words_locale/index":38,"./hu/build_distance_in_words_locale/index.js":38,"./hu/build_format_locale":39,"./hu/build_format_locale/":39,"./hu/build_format_locale/index":39,"./hu/build_format_locale/index.js":39,"./hu/index":95,"./hu/index.js":95,"./hu/package":175,"./hu/package.json":175,"./id":96,"./id/":96,"./id/build_distance_in_words_locale":40,"./id/build_distance_in_words_locale/":40,"./id/build_distance_in_words_locale/index":40,"./id/build_distance_in_words_locale/index.js":40,"./id/build_format_locale":41,"./id/build_format_locale/":41,"./id/build_format_locale/index":41,"./id/build_format_locale/index.js":41,"./id/index":96,"./id/index.js":96,"./id/package":176,"./id/package.json":176,"./is":97,"./is/":97,"./is/build_distance_in_words_locale":42,"./is/build_distance_in_words_locale/":42,"./is/build_distance_in_words_locale/index":42,"./is/build_distance_in_words_locale/index.js":42,"./is/build_format_locale":43,"./is/build_format_locale/":43,"./is/build_format_locale/index":43,"./is/build_format_locale/index.js":43,"./is/index":97,"./is/index.js":97,"./is/package":177,"./is/package.json":177,"./it":98,"./it/":98,"./it/build_distance_in_words_locale":44,"./it/build_distance_in_words_locale/":44,"./it/build_distance_in_words_locale/index":44,"./it/build_distance_in_words_locale/index.js":44,"./it/build_format_locale":45,"./it/build_format_locale/":45,"./it/build_format_locale/index":45,"./it/build_format_locale/index.js":45,"./it/index":98,"./it/index.js":98,"./it/package":178,"./it/package.json":178,"./ja":99,"./ja/":99,"./ja/build_distance_in_words_locale":46,"./ja/build_distance_in_words_locale/":46,"./ja/build_distance_in_words_locale/index":46,"./ja/build_distance_in_words_locale/index.js":46,"./ja/build_format_locale":47,"./ja/build_format_locale/":47,"./ja/build_format_locale/index":47,"./ja/build_format_locale/index.js":47,"./ja/index":99,"./ja/index.js":99,"./ja/package":179,"./ja/package.json":179,"./ko":100,"./ko/":100,"./ko/build_distance_in_words_locale":48,"./ko/build_distance_in_words_locale/":48,"./ko/build_distance_in_words_locale/index":48,"./ko/build_distance_in_words_locale/index.js":48,"./ko/build_format_locale":49,"./ko/build_format_locale/":49,"./ko/build_format_locale/index":49,"./ko/build_format_locale/index.js":49,"./ko/index":100,"./ko/index.js":100,"./ko/package":180,"./ko/package.json":180,"./mk":101,"./mk/":101,"./mk/build_distance_in_words_locale":50,"./mk/build_distance_in_words_locale/":50,"./mk/build_distance_in_words_locale/index":50,"./mk/build_distance_in_words_locale/index.js":50,"./mk/build_format_locale":51,"./mk/build_format_locale/":51,"./mk/build_format_locale/index":51,"./mk/build_format_locale/index.js":51,"./mk/index":101,"./mk/index.js":101,"./mk/package":181,"./mk/package.json":181,"./nb":102,"./nb/":102,"./nb/build_distance_in_words_locale":52,"./nb/build_distance_in_words_locale/":52,"./nb/build_distance_in_words_locale/index":52,"./nb/build_distance_in_words_locale/index.js":52,"./nb/build_format_locale":53,"./nb/build_format_locale/":53,"./nb/build_format_locale/index":53,"./nb/build_format_locale/index.js":53,"./nb/index":102,"./nb/index.js":102,"./nb/package":182,"./nb/package.json":182,"./nl":103,"./nl/":103,"./nl/build_distance_in_words_locale":54,"./nl/build_distance_in_words_locale/":54,"./nl/build_distance_in_words_locale/index":54,"./nl/build_distance_in_words_locale/index.js":54,"./nl/build_format_locale":55,"./nl/build_format_locale/":55,"./nl/build_format_locale/index":55,"./nl/build_format_locale/index.js":55,"./nl/index":103,"./nl/index.js":103,"./nl/package":183,"./nl/package.json":183,"./package":184,"./package.json":184,"./pl":104,"./pl/":104,"./pl/build_distance_in_words_locale":56,"./pl/build_distance_in_words_locale/":56,"./pl/build_distance_in_words_locale/index":56,"./pl/build_distance_in_words_locale/index.js":56,"./pl/build_format_locale":57,"./pl/build_format_locale/":57,"./pl/build_format_locale/index":57,"./pl/build_format_locale/index.js":57,"./pl/index":104,"./pl/index.js":104,"./pl/package":185,"./pl/package.json":185,"./pt":105,"./pt/":105,"./pt/build_distance_in_words_locale":58,"./pt/build_distance_in_words_locale/":58,"./pt/build_distance_in_words_locale/index":58,"./pt/build_distance_in_words_locale/index.js":58,"./pt/build_format_locale":59,"./pt/build_format_locale/":59,"./pt/build_format_locale/index":59,"./pt/build_format_locale/index.js":59,"./pt/index":105,"./pt/index.js":105,"./pt/package":186,"./pt/package.json":186,"./ro":106,"./ro/":106,"./ro/build_distance_in_words_locale":60,"./ro/build_distance_in_words_locale/":60,"./ro/build_distance_in_words_locale/index":60,"./ro/build_distance_in_words_locale/index.js":60,"./ro/build_format_locale":61,"./ro/build_format_locale/":61,"./ro/build_format_locale/index":61,"./ro/build_format_locale/index.js":61,"./ro/index":106,"./ro/index.js":106,"./ro/package":187,"./ro/package.json":187,"./ru":107,"./ru/":107,"./ru/build_distance_in_words_locale":62,"./ru/build_distance_in_words_locale/":62,"./ru/build_distance_in_words_locale/index":62,"./ru/build_distance_in_words_locale/index.js":62,"./ru/build_format_locale":63,"./ru/build_format_locale/":63,"./ru/build_format_locale/index":63,"./ru/build_format_locale/index.js":63,"./ru/index":107,"./ru/index.js":107,"./ru/package":188,"./ru/package.json":188,"./sk":108,"./sk/":108,"./sk/build_distance_in_words_locale":64,"./sk/build_distance_in_words_locale/":64,"./sk/build_distance_in_words_locale/index":64,"./sk/build_distance_in_words_locale/index.js":64,"./sk/build_format_locale":65,"./sk/build_format_locale/":65,"./sk/build_format_locale/index":65,"./sk/build_format_locale/index.js":65,"./sk/index":108,"./sk/index.js":108,"./sk/package":189,"./sk/package.json":189,"./sl":109,"./sl/":109,"./sl/build_distance_in_words_locale":66,"./sl/build_distance_in_words_locale/":66,"./sl/build_distance_in_words_locale/index":66,"./sl/build_distance_in_words_locale/index.js":66,"./sl/build_format_locale":67,"./sl/build_format_locale/":67,"./sl/build_format_locale/index":67,"./sl/build_format_locale/index.js":67,"./sl/index":109,"./sl/index.js":109,"./sl/package":190,"./sl/package.json":190,"./sv":110,"./sv/":110,"./sv/build_distance_in_words_locale":68,"./sv/build_distance_in_words_locale/":68,"./sv/build_distance_in_words_locale/index":68,"./sv/build_distance_in_words_locale/index.js":68,"./sv/build_format_locale":69,"./sv/build_format_locale/":69,"./sv/build_format_locale/index":69,"./sv/build_format_locale/index.js":69,"./sv/index":110,"./sv/index.js":110,"./sv/package":191,"./sv/package.json":191,"./th":111,"./th/":111,"./th/build_distance_in_words_locale":70,"./th/build_distance_in_words_locale/":70,"./th/build_distance_in_words_locale/index":70,"./th/build_distance_in_words_locale/index.js":70,"./th/build_format_locale":71,"./th/build_format_locale/":71,"./th/build_format_locale/index":71,"./th/build_format_locale/index.js":71,"./th/index":111,"./th/index.js":111,"./th/package":192,"./th/package.json":192,"./tr":112,"./tr/":112,"./tr/build_distance_in_words_locale":72,"./tr/build_distance_in_words_locale/":72,"./tr/build_distance_in_words_locale/index":72,"./tr/build_distance_in_words_locale/index.js":72,"./tr/build_format_locale":73,"./tr/build_format_locale/":73,"./tr/build_format_locale/index":73,"./tr/build_format_locale/index.js":73,"./tr/index":112,"./tr/index.js":112,"./tr/package":193,"./tr/package.json":193,"./zh_cn":113,"./zh_cn/":113,"./zh_cn/build_distance_in_words_locale":74,"./zh_cn/build_distance_in_words_locale/":74,"./zh_cn/build_distance_in_words_locale/index":74,"./zh_cn/build_distance_in_words_locale/index.js":74,"./zh_cn/build_format_locale":75,"./zh_cn/build_format_locale/":75,"./zh_cn/build_format_locale/index":75,"./zh_cn/build_format_locale/index.js":75,"./zh_cn/index":113,"./zh_cn/index.js":113,"./zh_cn/package":194,"./zh_cn/package.json":194,"./zh_tw":114,"./zh_tw/":114,"./zh_tw/build_distance_in_words_locale":76,"./zh_tw/build_distance_in_words_locale/":76,"./zh_tw/build_distance_in_words_locale/index":76,"./zh_tw/build_distance_in_words_locale/index.js":76,"./zh_tw/build_format_locale":77,"./zh_tw/build_format_locale/":77,"./zh_tw/build_format_locale/index":77,"./zh_tw/build_format_locale/index.js":77,"./zh_tw/index":114,"./zh_tw/index.js":114,"./zh_tw/package":195,"./zh_tw/package.json":195};function r(e){return n(i(e))}function i(e){var t=o[e];if(!(t+1))throw new Error("Cannot find module '"+e+"'.");return t}r.keys=function(){return Object.keys(o)},r.resolve=i,(e.exports=r).id=304;},function(e,t,n){var o=n(306),i=n(307),a=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var o in n)Object.prototype.hasOwnProperty.call(n,o)&&(e[o]=n[o]);}return e},s=function(){function o(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o);}}return function(e,t,n){return t&&o(e.prototype,t),n&&o(e,n),e}}();var u="carousel:ready",c="carousel:slide:before",l="carousel:slide:after",d=Symbol("onSwipeStart"),f=Symbol("onSwipeMove"),h=Symbol("onSwipeEnd"),m=!1;try{var r=Object.defineProperty({},"passive",{get:function(){m=!0;}});window.addEventListener("testPassive",null,r),window.removeEventListener("testPassive",null,r);}catch(e){}var p=function(e){function r(e){var t=1<arguments.length&&void 0!==arguments[1]?arguments[1]:{};!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,r);var n=function(e,t){if(!e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return !t||"object"!=typeof t&&"function"!=typeof t?e:t}(this,(r.__proto__||Object.getPrototypeOf(r)).call(this));if(n.element="string"==typeof e?document.querySelector(e):e,!n.element)throw new Error("An invalid selector or non-DOM node has been provided.");return n._clickEvents=["click"],n.options=a({},i.a,t),n.element.dataset.autoplay&&(n.options.autoplay=n.element.dataset.autoplay),n.element.dataset.delay&&(n.options.delay=n.element.dataset.delay),n.element.dataset.size&&!n.element.classList.contains("carousel-animate-fade")&&(n.options.size=n.element.dataset.size),n.element.classList.contains("carousel-animate-fade")&&(n.options.size=1),n.forceHiddenNavigation=!1,n[d]=n[d].bind(n),n[f]=n[f].bind(n),n[h]=n[h].bind(n),n.init(),n}return function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function, not "+typeof t);e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),t&&(Object.setPrototypeOf?Object.setPrototypeOf(e,t):e.__proto__=t);}(r,o["a"]),s(r,[{key:"init",value:function(){this.container=this.element.querySelector(".carousel-container"),this.items=this.element.querySelectorAll(".carousel-item"),this.currentItem={element:this.element,node:this.element.querySelector(".carousel-item.is-active"),pos:-1},this.currentItem.pos=this.currentItem.node?Array.from(this.items).indexOf(this.currentItem.node):-1,this.currentItem.node||(this.currentItem.node=this.items[0],this.currentItem.node.classList.add("is-active"),this.currentItem.pos=0),this.forceHiddenNavigation=this.items.length<=1;var e=this.element.querySelectorAll("img");[].forEach.call(e,function(e){e.setAttribute("draggable",!1);}),this._resize(),this._setOrder(),this._initNavigation(),this._bindEvents(),this.options.autoplay&&this._autoPlay(this.options.delay),this.emit(u,this.currentItem);}},{key:"_resize",value:function(){var t=this,e=window.getComputedStyle(this.element),n=parseInt(e.getPropertyValue("width"),10);if(1<this.options.size&&(this.options.size>=Array.from(this.items).length?this.offset=0:this.offset=n/this.options.size,this.container.style.left=0-this.offset+"px",this.container.style.transform="translateX("+this.offset+"px)",[].forEach.call(this.items,function(e){e.style.flexBasis=t.offset+"px";})),this.element.classList.contains("carousel-animate-fade")&&this.items.length){var o=this.items[0].querySelector("img"),r=1;o.naturalWidth?(r=n/o.naturalWidth,this.container.style.height=o.naturalHeight*r+"px"):o.onload=function(){r=n/o.naturalWidth,t.container.style.height=o.naturalHeight*r+"px";};}}},{key:"_bindEvents",value:function(){var t=this;this.previousControl&&this._clickEvents.forEach(function(e){t.previousControl.addEventListener(e,function(e){m||e.preventDefault(),t._autoPlayInterval&&(clearInterval(t._autoPlayInterval),t._autoPlay(t.optionsdelay)),t._slide("previous");},!!m&&{passive:!0});}),this.nextControl&&this._clickEvents.forEach(function(e){t.nextControl.addEventListener(e,function(e){m||e.preventDefault(),t._autoPlayInterval&&(clearInterval(t._autoPlayInterval),t._autoPlay(t.options.delay)),t._slide("next");},!!m&&{passive:!0});}),this.element.addEventListener("touchstart",this[d],!!m&&{passive:!0}),this.element.addEventListener("mousedown",this[d],!!m&&{passive:!0}),this.element.addEventListener("touchmove",this[f],!!m&&{passive:!0}),this.element.addEventListener("mousemove",this[f],!!m&&{passive:!0}),this.element.addEventListener("touchend",this[h],!!m&&{passive:!0}),this.element.addEventListener("mouseup",this[h],!!m&&{passive:!0});}},{key:"destroy",value:function(){this.element.removeEventListener("touchstart",this[d],!!m&&{passive:!0}),this.element.removeEventListener("mousedown",this[d],!!m&&{passive:!0}),this.element.removeEventListener("touchmove",this[f],!!m&&{passive:!0}),this.element.removeEventListener("mousemove",this[f],!!m&&{passive:!0}),this.element.removeEventListener("touchend",this[h],!!m&&{passive:!0}),this.element.removeEventListener("mouseup",this[h],!!m&&{passive:!0});}},{key:d,value:function(e){m||e.preventDefault(),e="changedTouches"in(e=e||window.event)?e.changedTouches[0]:e,this._touch={start:{time:(new Date).getTime(),x:e.pageX,y:e.pageY},dist:{x:0,y:0}};}},{key:f,value:function(e){m||e.preventDefault();}},{key:h,value:function(e){m||e.preventDefault(),e="changedTouches"in(e=e||window.event)?e.changedTouches[0]:e,this._touch.dist={x:e.pageX-this._touch.start.x,y:e.pageY-this._touch.start.y},this._handleGesture();}},{key:"_handleGesture",value:function(){(new Date).getTime()-this._touch.start.time<=this.options.allowedTime&&Math.abs(this._touch.dist.x)>=this.options.threshold&&Math.abs(this._touch.dist.y)<=this.options.restraint&&(this._touch.dist.x<0?this._slide("next"):this._slide("previous"));}},{key:"_initNavigation",value:function(){this.previousControl=this.element.querySelector(".carousel-nav-left"),this.nextControl=this.element.querySelector(".carousel-nav-right"),(this.items.length<=1||this.forceHiddenNavigation)&&(this.container&&(this.container.style.left="0"),this.previousControl&&(this.previousControl.style.display="none"),this.nextControl&&(this.nextControl.style.display="none"));}},{key:"_setOrder",value:function(){this.currentItem.node.style.order="1",this.currentItem.node.style.zIndex="1";var e,t=this.currentItem.node,n=void 0,o=void 0;for(n=o=2,e=Array.from(this.items).length;2<=e?o<=e:e<=o;n=2<=e?++o:--o)(t=this._next(t)).style.order=""+n%Array.from(this.items).length,t.style.zIndex="0";}},{key:"_next",value:function(e){return e.nextElementSibling?e.nextElementSibling:this.items[0]}},{key:"_previous",value:function(e){return e.previousElementSibling?e.previousElementSibling:this.items[this.items.length-1]}},{key:"_slide",value:function(){var e=this,t=0<arguments.length&&void 0!==arguments[0]?arguments[0]:"next";this.items.length&&(this.oldItemNode=this.currentItem.node,this.emit(c,this.currentItem),"previous"===t?(this.currentItem.node=this._previous(this.currentItem.node),this.element.classList.contains("carousel-animate-fade")||(this.element.classList.add("is-reversing"),this.container.style.transform="translateX("+-Math.abs(this.offset)+"px)")):(this.currentItem.node=this._next(this.currentItem.node),this.element.classList.remove("is-reversing"),this.container.style.transform="translateX("+Math.abs(this.offset)+"px)"),this.currentItem.node.classList.add("is-active"),this.oldItemNode.classList.remove("is-active"),this.element.classList.remove("carousel-animated"),setTimeout(function(){e.element.classList.add("carousel-animated");},50),this._setOrder(),this.emit(l,this.currentItem));}},{key:"_autoPlay",value:function(){var e=this,t=0<arguments.length&&void 0!==arguments[0]?arguments[0]:5e3;this._autoPlayInterval=setInterval(function(){e._slide("next");},t);}}],[{key:"attach",value:function(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:".carousel, .hero-carousel",t=1<arguments.length&&void 0!==arguments[1]?arguments[1]:{},n=new Array,o=document.querySelectorAll(e);return [].forEach.call(o,function(e){setTimeout(function(){n.push(new r(e,t));},100);}),n}}]),r}();t.a=p;},function(e,t,n){var o=function(){function o(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o);}}return function(e,t,n){return t&&o(e.prototype,t),n&&o(e,n),e}}();var r=function(){function t(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:[];!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,t),this._listeners=new Map(e),this._middlewares=new Map;}return o(t,[{key:"listenerCount",value:function(e){return this._listeners.has(e)?this._listeners.get(e).length:0}},{key:"removeListeners",value:function(){var t=this,e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null,n=1<arguments.length&&void 0!==arguments[1]&&arguments[1];null!==e?Array.isArray(e)?name.forEach(function(e){return t.removeListeners(e,n)}):(this._listeners.delete(e),n&&this.removeMiddleware(e)):this._listeners=new Map;}},{key:"middleware",value:function(e,t){var n=this;Array.isArray(e)?name.forEach(function(e){return n.middleware(e,t)}):(Array.isArray(this._middlewares.get(e))||this._middlewares.set(e,[]),this._middlewares.get(e).push(t));}},{key:"removeMiddleware",value:function(){var t=this,e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null;null!==e?Array.isArray(e)?name.forEach(function(e){return t.removeMiddleware(e)}):this._middlewares.delete(e):this._middlewares=new Map;}},{key:"on",value:function(e,t){var n=this,o=2<arguments.length&&void 0!==arguments[2]&&arguments[2];if(Array.isArray(e))e.forEach(function(e){return n.on(e,t)});else {var r=(e=e.toString()).split(/,|, | /);1<r.length?r.forEach(function(e){return n.on(e,t)}):(Array.isArray(this._listeners.get(e))||this._listeners.set(e,[]),this._listeners.get(e).push({once:o,callback:t}));}}},{key:"once",value:function(e,t){this.on(e,t,!0);}},{key:"emit",value:function(n,o){var r=this,i=2<arguments.length&&void 0!==arguments[2]&&arguments[2];n=n.toString();var a=this._listeners.get(n),s=null,u=0,c=i;if(Array.isArray(a))for(a.forEach(function(e,t){i||(s=r._middlewares.get(n),Array.isArray(s)?(s.forEach(function(e){e(o,function(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null;null!==e&&(o=e),u++;},n);}),u>=s.length&&(c=!0)):c=!0),c&&(e.once&&(a[t]=null),e.callback(o));});-1!==a.indexOf(null);)a.splice(a.indexOf(null),1);}}]),t}();t.a=r;},function(e,t,n){t.a={size:1,autoplay:!1,delay:5e3,threshold:50,restraint:100,allowedTime:500};},function(e,t,n){var o=n(309),i=n(310),c=function(e,t){if(Array.isArray(e))return e;if(Symbol.iterator in Object(e))return function(e,t){var n=[],o=!0,r=!1,i=void 0;try{for(var a,s=e[Symbol.iterator]();!(o=(a=s.next()).done)&&(n.push(a.value),!t||n.length!==t);o=!0);}catch(e){r=!0,i=e;}finally{try{!o&&s.return&&s.return();}finally{if(r)throw i}}return n}(e,t);throw new TypeError("Invalid attempt to destructure non-iterable instance")},a=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var o in n)Object.prototype.hasOwnProperty.call(n,o)&&(e[o]=n[o]);}return e},s=function(){function o(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o);}}return function(e,t,n){return t&&o(e.prototype,t),n&&o(e,n),e}}();var r=function(e){function r(e){var t=1<arguments.length&&void 0!==arguments[1]?arguments[1]:{};!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,r);var n=function(e,t){if(!e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return !t||"object"!=typeof t&&"function"!=typeof t?e:t}(this,(r.__proto__||Object.getPrototypeOf(r)).call(this));if(n.element="string"==typeof e?document.querySelector(e):e,!n.element)throw new Error("An invalid selector or non-DOM node has been provided.");return n._clickEvents=["click"],n.options=a({},i.a,t),n.icons=[],n.id="iconPicker"+(new Date).getTime(),n.init(),n}return function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function, not "+typeof t);e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),t&&(Object.setPrototypeOf?Object.setPrototypeOf(e,t):e.__proto__=t);}(r,o["a"]),s(r,[{key:"init",value:function(){var r=this;this.createModal(),this.createPreview(),this.options.iconSets.forEach(function(n){var o;o=n.css,new Promise(function(e,t){var n=document.createElement("link");n.type="text/css",n.rel="stylesheet",n.onload=function(){e();},n.href=o,document.querySelector('link[href="'+o+'"]')||document.querySelector("head").append(n);}),fetch(n.css,{mode:"cors"}).then(function(e){return e.text()}).then(function(e){r.icons[n.name]=r.parseCSS(e,n.prefix||"fa-",n.displayPrefix||""),r.modalSetTabs.querySelector("a").click();var t=new Event("touchstart");r.modalSetTabs.querySelector("a").dispatchEvent(t);});});}},{key:"createPreview",value:function(){var t=this;this.preview=document.createElement("div"),this.preview.className="icon is-large",this.preview.classList.add("iconpicker-preview");var n=document.createElement("i");(n.className="iconpicker-icon-preview",this.element.value.length)&&this.element.value.split(" ").forEach(function(e){n.classList.add(e);});this.preview.appendChild(n),this._clickEvents.forEach(function(e){t.preview.addEventListener(e,function(e){e.preventDefault(),t.modal.classList.add("is-active");});}),this.element.parentNode.insertBefore(this.preview,this.element.nextSibling);}},{key:"parseCSS",value:function(e){for(var t=1<arguments.length&&void 0!==arguments[1]?arguments[1]:"fa-",n=2<arguments.length&&void 0!==arguments[2]?arguments[2]:"",o=new RegExp("\\."+t+"([^\\.!:]*)::?before\\s*{\\s*content:\\s*[\"|']\\\\[^'|\"]*[\"|'];?\\s*}","g"),r=[],i=void 0,a=void 0;a=o.exec(e);)i={prefix:t,selector:t+a[1].trim(":"),name:this.ucwords(a[1]).trim(":"),filter:a[1].trim(":"),displayPrefix:n},r[a[1]]=i;return 0==Object.getOwnPropertyNames(this.icons).length&&console.warn("No icons found in CSS file"),r}},{key:"ucwords",value:function(e){return (e+"").replace(/^(.)|\s+(.)/g,function(e){return e.toUpperCase()})}},{key:"drawIcons",value:function(e){if(this.iconsList.innerHTML="",e){var t=!0,n=!1,o=void 0;try{for(var r,i=Object.entries(e)[Symbol.iterator]();!(t=(r=i.next()).done);t=!0){var a=r.value,s=c(a,2),u=(s[0],s[1]);this.iconsList.appendChild(this.createIconPreview(u));}}catch(e){n=!0,o=e;}finally{try{!t&&i.return&&i.return();}finally{if(n)throw o}}}}},{key:"createIconPreview",value:function(e){var t=this,n=(document.createElement("a"));n.dataset.title=e.name,n.setAttribute("title",e.name),n.dataset.icon=e.selector,n.dataset.filter=e.filter;var o=document.createElement("i");return o.className="iconpicker-icon-preview",e.displayPrefix.length&&e.displayPrefix.split(" ").forEach(function(e){o.classList.add(e);}),o.classList.add(e.selector),n.appendChild(o),this._clickEvents.forEach(function(e){n.addEventListener(e,function(e){e.preventDefault(),t.preview.innerHTML="",t.element.value=e.target.classList,t.element.dispatchEvent(new Event("change")),t.preview.appendChild(e.target.cloneNode(!0)),t.modal.classList.remove("is-active");});}),n}},{key:"createModal",value:function(){var o=this;this.modal=document.createElement("div"),this.modal.className="modal",this.modal.classList.add("iconpicker-modal"),this.modal.id=this.id;var e=document.createElement("div");e.className="modal-background";var t=document.createElement("div");t.className="modal-card";var n=document.createElement("header");n.className="modal-card-head";var r=document.createElement("p");r.className="modal-card-title",r.innerHTML="iconPicker",this.modalHeaderSearch=document.createElement("input"),this.modalHeaderSearch.setAttribute("type","search"),this.modalHeaderSearch.setAttribute("placeholder","Search"),this.modalHeaderSearch.className="iconpicker-search",this.modalHeaderSearch.addEventListener("input",function(e){o.filter(e.target.value);});var i=document.createElement("button");if(i.className="delete",this._clickEvents.forEach(function(e){i.addEventListener(e,function(e){e.preventDefault(),o.modal.classList.remove("is-active");});}),t.appendChild(n),this.modalBody=document.createElement("section"),this.modalBody.className="modal-card-body",1<=this.options.iconSets.length){var a=document.createElement("div");a.className="iconpicker-sets",a.classList.add("tabs"),this.modalSetTabs=document.createElement("ul"),this.options.iconSets.forEach(function(e){var t=document.createElement("li"),n=document.createElement("a");n.dataset.iconset=e.name,n.innerHTML=e.name,o._clickEvents.forEach(function(e){n.addEventListener(e,function(e){e.preventDefault();var t=o.modalSetTabs.querySelectorAll(".is-active");[].forEach.call(t,function(e){e.classList.remove("is-active");}),e.target.parentNode.classList.add("is-active"),o.drawIcons(o.icons[e.target.dataset.iconset]),o.filter(o.modalHeaderSearch.value);});}),t.appendChild(n),o.modalSetTabs.appendChild(t);}),a.appendChild(this.modalSetTabs),t.appendChild(a);}this.iconsList=document.createElement("div"),this.iconsList.className="iconpicker-icons",n.appendChild(r),n.appendChild(this.modalHeaderSearch),n.appendChild(i),this.modalBody.appendChild(this.iconsList),t.appendChild(this.modalBody),this.modal.appendChild(e),this.modal.appendChild(t),document.body.appendChild(this.modal);}},{key:"filter",value:function(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:"";""!==e?(this.iconsList.querySelectorAll("[data-filter]").forEach(function(e){e.classList.remove("is-hidden");}),this.iconsList.querySelectorAll('[data-filter]:not([data-filter*="'+e+'"])').forEach(function(e){e.classList.add("is-hidden");})):this.iconsList.querySelectorAll("[data-filter]").forEach(function(e){e.classList.remove("is-hidden");});}}],[{key:"attach",value:function(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:'[data-action="iconPicker"]',t=1<arguments.length&&void 0!==arguments[1]?arguments[1]:{},n=new Array,o=document.querySelectorAll(e);return [].forEach.call(o,function(e){setTimeout(function(){n.push(new r(e,t));},100);}),n}}]),r}();t.a=r;},function(e,t,n){var o=function(){function o(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o);}}return function(e,t,n){return t&&o(e.prototype,t),n&&o(e,n),e}}();var r=function(){function t(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:[];!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,t),this._listeners=new Map(e),this._middlewares=new Map;}return o(t,[{key:"listenerCount",value:function(e){return this._listeners.has(e)?this._listeners.get(e).length:0}},{key:"removeListeners",value:function(){var t=this,e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null,n=1<arguments.length&&void 0!==arguments[1]&&arguments[1];null!==e?Array.isArray(e)?name.forEach(function(e){return t.removeListeners(e,n)}):(this._listeners.delete(e),n&&this.removeMiddleware(e)):this._listeners=new Map;}},{key:"middleware",value:function(e,t){var n=this;Array.isArray(e)?name.forEach(function(e){return n.middleware(e,t)}):(Array.isArray(this._middlewares.get(e))||this._middlewares.set(e,[]),this._middlewares.get(e).push(t));}},{key:"removeMiddleware",value:function(){var t=this,e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null;null!==e?Array.isArray(e)?name.forEach(function(e){return t.removeMiddleware(e)}):this._middlewares.delete(e):this._middlewares=new Map;}},{key:"on",value:function(e,t){var n=this,o=2<arguments.length&&void 0!==arguments[2]&&arguments[2];if(Array.isArray(e))e.forEach(function(e){return n.on(e,t)});else {var r=(e=e.toString()).split(/,|, | /);1<r.length?r.forEach(function(e){return n.on(e,t)}):(Array.isArray(this._listeners.get(e))||this._listeners.set(e,[]),this._listeners.get(e).push({once:o,callback:t}));}}},{key:"once",value:function(e,t){this.on(e,t,!0);}},{key:"emit",value:function(n,o){var r=this,i=2<arguments.length&&void 0!==arguments[2]&&arguments[2];n=n.toString();var a=this._listeners.get(n),s=null,u=0,c=i;if(Array.isArray(a))for(a.forEach(function(e,t){i||(s=r._middlewares.get(n),Array.isArray(s)?(s.forEach(function(e){e(o,function(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null;null!==e&&(o=e),u++;},n);}),u>=s.length&&(c=!0)):c=!0),c&&(e.once&&(a[t]=null),e.callback(o));});-1!==a.indexOf(null);)a.splice(a.indexOf(null),1);}}]),t}();t.a=r;},function(e,t,n){t.a={iconSets:[{name:"simpleLine",css:"https://cdnjs.cloudflare.com/ajax/libs/simple-line-icons/2.4.1/css/simple-line-icons.css",prefix:"icon-",displayPrefix:""},{name:"fontAwesome",css:"https://use.fontawesome.com/releases/v5.0.13/css/all.css",prefix:"fa-",displayPrefix:"fas fa-icon"}]};},function(e,t,n){var o=n(312),i=n(313),a=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var o in n)Object.prototype.hasOwnProperty.call(n,o)&&(e[o]=n[o]);}return e},s=function(){function o(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o);}}return function(e,t,n){return t&&o(e.prototype,t),n&&o(e,n),e}}();var u=Symbol("onQuickviewShowClick"),c=Symbol("onQuickviewDismissClick"),r=function(e){function r(e){var t=1<arguments.length&&void 0!==arguments[1]?arguments[1]:{};!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,r);var n=function(e,t){if(!e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return !t||"object"!=typeof t&&"function"!=typeof t?e:t}(this,(r.__proto__||Object.getPrototypeOf(r)).call(this));if(n.element="string"==typeof e?document.querySelector(e):e,!n.element)throw new Error("An invalid selector or non-DOM node has been provided.");return n._clickEvents=["click"],n.options=a({},i.a,t),n[u]=n[u].bind(n),n[c]=n[c].bind(n),n.init(),n}return function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function, not "+typeof t);e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),t&&(Object.setPrototypeOf?Object.setPrototypeOf(e,t):e.__proto__=t);}(r,o["a"]),s(r,[{key:"init",value:function(){this.quickview=document.getElementById(this.element.dataset.target),this.dismissElements=document.querySelectorAll('[data-dismiss="quickview"]'),this._bindEvents(),this.emit("quickview:ready",{element:this.element,quickview:this.quickview});}},{key:"_bindEvents",value:function(){var n=this;this._clickEvents.forEach(function(e){n.element.addEventListener(e,n[u],!1);}),[].forEach.call(this.dismissElements,function(t){n._clickEvents.forEach(function(e){t.addEventListener(e,n[c],!1);});});}},{key:u,value:function(e){this.quickview.classList.add("is-active"),this.emit("quickview:show",{element:this.element,quickview:this.quickview});}},{key:c,value:function(e){this.quickview.classList.remove("is-active"),this.emit("quickview:hide",{element:this.element,quickview:this.quickview});}}],[{key:"attach",value:function(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:'[data-show="quickview"]',t=1<arguments.length&&void 0!==arguments[1]?arguments[1]:{},n=new Array,o=document.querySelectorAll(e);return [].forEach.call(o,function(e){setTimeout(function(){n.push(new r(e,t));},100);}),n}}]),r}();t.a=r;},function(e,t,n){var o=function(){function o(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o);}}return function(e,t,n){return t&&o(e.prototype,t),n&&o(e,n),e}}();var r=function(){function t(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:[];!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,t),this._listeners=new Map(e),this._middlewares=new Map;}return o(t,[{key:"listenerCount",value:function(e){return this._listeners.has(e)?this._listeners.get(e).length:0}},{key:"removeListeners",value:function(){var t=this,e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null,n=1<arguments.length&&void 0!==arguments[1]&&arguments[1];null!==e?Array.isArray(e)?name.forEach(function(e){return t.removeListeners(e,n)}):(this._listeners.delete(e),n&&this.removeMiddleware(e)):this._listeners=new Map;}},{key:"middleware",value:function(e,t){var n=this;Array.isArray(e)?name.forEach(function(e){return n.middleware(e,t)}):(Array.isArray(this._middlewares.get(e))||this._middlewares.set(e,[]),this._middlewares.get(e).push(t));}},{key:"removeMiddleware",value:function(){var t=this,e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null;null!==e?Array.isArray(e)?name.forEach(function(e){return t.removeMiddleware(e)}):this._middlewares.delete(e):this._middlewares=new Map;}},{key:"on",value:function(e,t){var n=this,o=2<arguments.length&&void 0!==arguments[2]&&arguments[2];if(Array.isArray(e))e.forEach(function(e){return n.on(e,t)});else {var r=(e=e.toString()).split(/,|, | /);1<r.length?r.forEach(function(e){return n.on(e,t)}):(Array.isArray(this._listeners.get(e))||this._listeners.set(e,[]),this._listeners.get(e).push({once:o,callback:t}));}}},{key:"once",value:function(e,t){this.on(e,t,!0);}},{key:"emit",value:function(n,o){var r=this,i=2<arguments.length&&void 0!==arguments[2]&&arguments[2];n=n.toString();var a=this._listeners.get(n),s=null,u=0,c=i;if(Array.isArray(a))for(a.forEach(function(e,t){i||(s=r._middlewares.get(n),Array.isArray(s)?(s.forEach(function(e){e(o,function(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null;null!==e&&(o=e),u++;},n);}),u>=s.length&&(c=!0)):c=!0),c&&(e.once&&(a[t]=null),e.callback(o));});-1!==a.indexOf(null);)a.splice(a.indexOf(null),1);}}]),t}();t.a=r;},function(e,t,n){t.a={};},function(e,t,n){var o=n(315),i=n(316),a=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var o in n)Object.prototype.hasOwnProperty.call(n,o)&&(e[o]=n[o]);}return e},s=function(){function o(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o);}}return function(e,t,n){return t&&o(e.prototype,t),n&&o(e,n),e}}();var u=Symbol("onSliderInput"),r=function(e){function r(e){var t=1<arguments.length&&void 0!==arguments[1]?arguments[1]:{};!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,r);var n=function(e,t){if(!e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return !t||"object"!=typeof t&&"function"!=typeof t?e:t}(this,(r.__proto__||Object.getPrototypeOf(r)).call(this));if(n.element="string"==typeof e?document.querySelector(e):e,!n.element)throw new Error("An invalid selector or non-DOM node has been provided.");return n._clickEvents=["click"],n.options=a({},i.a,t),n[u]=n[u].bind(n),n.init(),n}return function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function, not "+typeof t);e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),t&&(Object.setPrototypeOf?Object.setPrototypeOf(e,t):e.__proto__=t);}(r,o["a"]),s(r,[{key:"init",value:function(){if(this._id="bulmaSlider"+(new Date).getTime()+Math.floor(Math.random()*Math.floor(9999)),this.output=this._findOutputForSlider(),this.output&&this.element.classList.contains("has-output-tooltip")){var e=this._getSliderOutputPosition();this.output.style.left=e.position;}this.emit("bulmaslider:ready",this.element.value);}},{key:"_findOutputForSlider",value:function(){var t=this,e=document.getElementsByTagName("output");return [].forEach.call(e,function(e){if(e.htmlFor==t.element.getAttribute("id"))return e}),null}},{key:"_getSliderOutputPosition",value:function(){var e,t=window.getComputedStyle(this.element,null),n=parseInt(t.getPropertyValue("width"),10);e=this.element.getAttribute("min")?this.element.getAttribute("min"):0;var o=(this.element.value-e)/(this.element.getAttribute("max")-e);return {position:(o<0?0:1<o?n:n*o)+"px"}}},{key:"_bindEvents",value:function(){this.output&&this.element.addEventListener("input",this[u],!1);}},{key:u,value:function(e){if(e.preventDefault(),this.element.classList.contains("has-output-tooltip")){var t=this._getSliderOutputPosition();this.output.style.left=t.position;}var n=this.output.hasAttribute("data-prefix")?this.output.getAttribute("data-prefix"):"",o=this.output.hasAttribute("data-postfix")?this.output.getAttribute("data-postfix"):"";this.output.value=n+this.element.value+o,this.emit("bulmaslider:ready",this.element.value);}}],[{key:"attach",value:function(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:'input[type="range"].slider',t=1<arguments.length&&void 0!==arguments[1]?arguments[1]:{},n=new Array,o=document.querySelectorAll(e);return [].forEach.call(o,function(e){setTimeout(function(){n.push(new r(e,t));},100);}),n}}]),r}();t.a=r;},function(e,t,n){var o=function(){function o(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o);}}return function(e,t,n){return t&&o(e.prototype,t),n&&o(e,n),e}}();var r=function(){function t(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:[];!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,t),this._listeners=new Map(e),this._middlewares=new Map;}return o(t,[{key:"listenerCount",value:function(e){return this._listeners.has(e)?this._listeners.get(e).length:0}},{key:"removeListeners",value:function(){var t=this,e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null,n=1<arguments.length&&void 0!==arguments[1]&&arguments[1];null!==e?Array.isArray(e)?name.forEach(function(e){return t.removeListeners(e,n)}):(this._listeners.delete(e),n&&this.removeMiddleware(e)):this._listeners=new Map;}},{key:"middleware",value:function(e,t){var n=this;Array.isArray(e)?name.forEach(function(e){return n.middleware(e,t)}):(Array.isArray(this._middlewares.get(e))||this._middlewares.set(e,[]),this._middlewares.get(e).push(t));}},{key:"removeMiddleware",value:function(){var t=this,e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null;null!==e?Array.isArray(e)?name.forEach(function(e){return t.removeMiddleware(e)}):this._middlewares.delete(e):this._middlewares=new Map;}},{key:"on",value:function(e,t){var n=this,o=2<arguments.length&&void 0!==arguments[2]&&arguments[2];if(Array.isArray(e))e.forEach(function(e){return n.on(e,t)});else {var r=(e=e.toString()).split(/,|, | /);1<r.length?r.forEach(function(e){return n.on(e,t)}):(Array.isArray(this._listeners.get(e))||this._listeners.set(e,[]),this._listeners.get(e).push({once:o,callback:t}));}}},{key:"once",value:function(e,t){this.on(e,t,!0);}},{key:"emit",value:function(n,o){var r=this,i=2<arguments.length&&void 0!==arguments[2]&&arguments[2];n=n.toString();var a=this._listeners.get(n),s=null,u=0,c=i;if(Array.isArray(a))for(a.forEach(function(e,t){i||(s=r._middlewares.get(n),Array.isArray(s)?(s.forEach(function(e){e(o,function(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null;null!==e&&(o=e),u++;},n);}),u>=s.length&&(c=!0)):c=!0),c&&(e.once&&(a[t]=null),e.callback(o));});-1!==a.indexOf(null);)a.splice(a.indexOf(null),1);}}]),t}();t.a=r;},function(e,t,n){t.a={};},function(e,t,n){var o=n(318),i=n(319),a=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var o in n)Object.prototype.hasOwnProperty.call(n,o)&&(e[o]=n[o]);}return e},s=function(){function o(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o);}}return function(e,t,n){return t&&o(e.prototype,t),n&&o(e,n),e}}();var u=Symbol("onStepsPrevious"),c=Symbol("onStepsNext"),r=function(e){function r(e){var t=1<arguments.length&&void 0!==arguments[1]?arguments[1]:{};!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,r);var n=function(e,t){if(!e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return !t||"object"!=typeof t&&"function"!=typeof t?e:t}(this,(r.__proto__||Object.getPrototypeOf(r)).call(this));if(n.element="string"==typeof e?document.querySelector(e):e,!n.element)throw new Error("An invalid selector or non-DOM node has been provided.");return n._clickEvents=["click"],n.options=a({},i.a,t),n[u]=n[u].bind(n),n[c]=n[c].bind(n),n.init(),n}return function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function, not "+typeof t);e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),t&&(Object.setPrototypeOf?Object.setPrototypeOf(e,t):e.__proto__=t);}(r,o["a"]),s(r,[{key:"init",value:function(){this._id="bulmaSteps"+(new Date).getTime()+Math.floor(Math.random()*Math.floor(9999)),this.steps=this.element.querySelectorAll(this.options.selector),this.contents=this.element.querySelectorAll(this.options.selector_content),this.previous_btn=this.element.querySelector(this.options.previous_selector),this.next_btn=this.element.querySelector(this.options.next_selector),[].forEach.call(this.steps,function(e,t){e.setAttribute("data-step-id",t);}),this.steps&&this.steps.length&&(this.activate_step(0),this.updateActions(this.steps[0])),this._bindEvents(),this.emit("bulmasteps:ready",this.element.value);}},{key:"_bindEvents",value:function(){var n=this;null!=this.previous_btn&&this._clickEvents.forEach(function(e){n.previous_btn.addEventListener(e,n[u],!1);}),null!=this.next_btn&&this._clickEvents.forEach(function(e){n.next_btn.addEventListener(e,n[c],!1);}),this.options.stepClickable&&[].forEach.call(this.steps,function(e,t){n._clickEvents.forEach(function(e){for(;t>n.current_id;)n[c](e);for(;t<n.current_id;)n[u](e);});});}},{key:u,value:function(e){e.preventDefault(),e.target.getAttribute("disabled")||this.previous_step();}},{key:c,value:function(e){e.preventDefault(),e.target.getAttribute("disabled")||this.next_step();}},{key:"get_current_step_id",value:function(){for(var e=0;e<this.steps.length;e++){var t=this.steps[e];if(t.classList.contains(this.options.active_class))return parseInt(t.getAttribute("data-step-id"))}return null}},{key:"updateActions",value:function(e){var t=parseInt(e.getAttribute("data-step-id"));0==t?(null!=this.previous_btn&&this.previous_btn.setAttribute("disabled","disabled"),null!=this.next_btn&&this.next_btn.removeAttribute("disabled","disabled")):t==this.steps.length-1?(null!=this.previous_btn&&this.previous_btn.removeAttribute("disabled","disabled"),null!=this.next_btn&&this.next_btn.setAttribute("disabled","disabled")):(null!=this.previous_btn&&this.previous_btn.removeAttribute("disabled","disabled"),null!=this.next_btn&&this.next_btn.removeAttribute("disabled","disabled"));}},{key:"next_step",value:function(){var e=this.get_current_step_id();if(null!=e){var t=e+1,n=[];if(void 0!==this.options.beforeNext&&null!=this.options.beforeNext&&this.options.beforeNext&&(n=this.options.beforeNext(e)),this.emit("bulmasteps:before:next",e),void 0===n&&(n=[]),0<n.length){this.emit("bulmasteps:errors",n);for(var o=0;o<n.length;o++)void 0!==this.options.onError&&null!=this.options.onError&&this.options.onError&&this.options.onError(n[o]);}else t>=this.steps.length-1&&(void 0!==this.options.onFinish&&null!=this.options.onFinish&&this.options.onFinish&&this.options.onFinish(e),this.emit("bulmasteps:finish",e)),t<this.steps.length&&(this.complete_step(e),this.activate_step(t));}}},{key:"previous_step",value:function(){var e=this.get_current_step_id();null!=e&&(this.uncomplete_step(e-1),this.activate_step(e-1));}},{key:"activate_step",value:function(e){this.updateActions(this.steps[e]);for(var t=0;t<this.steps.length;t++){this.steps[t]!=this.steps[e]&&this.deactivate_step(t);}this.steps[e].classList.add(this.options.active_class),void 0!==this.contents[e]&&this.contents[e].classList.add(this.options.active_class),void 0!==this.options.onShow&&null!=this.options.onShow&&this.options.onShow&&this.options.onShow(e),this.emit("bulmasteps:step:show",e);}},{key:"complete_step",value:function(e){this.steps[e].classList.add(this.options.completed_class),this.emit("bulmasteps:step:completed",e);}},{key:"uncomplete_step",value:function(e){this.steps[e].classList.remove(this.options.completed_class),this.emit("bulmasteps:step:uncompleted",e);}},{key:"deactivate_step",value:function(e){this.steps[e].classList.remove(this.options.active_class),void 0!==this.contents[e]&&this.contents[e].classList.remove(this.options.active_class);}}],[{key:"attach",value:function(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:".steps",t=1<arguments.length&&void 0!==arguments[1]?arguments[1]:{},n=new Array,o=document.querySelectorAll(e);return [].forEach.call(o,function(e){setTimeout(function(){n.push(new r(e,t));},100);}),n}}]),r}();t.a=r;},function(e,t,n){var o=function(){function o(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o);}}return function(e,t,n){return t&&o(e.prototype,t),n&&o(e,n),e}}();var r=function(){function t(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:[];!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,t),this._listeners=new Map(e),this._middlewares=new Map;}return o(t,[{key:"listenerCount",value:function(e){return this._listeners.has(e)?this._listeners.get(e).length:0}},{key:"removeListeners",value:function(){var t=this,e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null,n=1<arguments.length&&void 0!==arguments[1]&&arguments[1];null!==e?Array.isArray(e)?name.forEach(function(e){return t.removeListeners(e,n)}):(this._listeners.delete(e),n&&this.removeMiddleware(e)):this._listeners=new Map;}},{key:"middleware",value:function(e,t){var n=this;Array.isArray(e)?name.forEach(function(e){return n.middleware(e,t)}):(Array.isArray(this._middlewares.get(e))||this._middlewares.set(e,[]),this._middlewares.get(e).push(t));}},{key:"removeMiddleware",value:function(){var t=this,e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null;null!==e?Array.isArray(e)?name.forEach(function(e){return t.removeMiddleware(e)}):this._middlewares.delete(e):this._middlewares=new Map;}},{key:"on",value:function(e,t){var n=this,o=2<arguments.length&&void 0!==arguments[2]&&arguments[2];if(Array.isArray(e))e.forEach(function(e){return n.on(e,t)});else {var r=(e=e.toString()).split(/,|, | /);1<r.length?r.forEach(function(e){return n.on(e,t)}):(Array.isArray(this._listeners.get(e))||this._listeners.set(e,[]),this._listeners.get(e).push({once:o,callback:t}));}}},{key:"once",value:function(e,t){this.on(e,t,!0);}},{key:"emit",value:function(n,o){var r=this,i=2<arguments.length&&void 0!==arguments[2]&&arguments[2];n=n.toString();var a=this._listeners.get(n),s=null,u=0,c=i;if(Array.isArray(a))for(a.forEach(function(e,t){i||(s=r._middlewares.get(n),Array.isArray(s)?(s.forEach(function(e){e(o,function(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null;null!==e&&(o=e),u++;},n);}),u>=s.length&&(c=!0)):c=!0),c&&(e.once&&(a[t]=null),e.callback(o));});-1!==a.indexOf(null);)a.splice(a.indexOf(null),1);}}]),t}();t.a=r;},function(e,t,n){t.a={selector:".step-item",selector_content:".step-content",previous_selector:'[data-nav="previous"]',next_selector:'[data-nav="next"]',active_class:"is-active",completed_class:"is-completed",stepClickable:!1,beforeNext:null,onShow:null,onFinish:null,onError:null};},function(e,t,n){var o=n(321),i=n(322),a=n(323),s=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var o in n)Object.prototype.hasOwnProperty.call(n,o)&&(e[o]=n[o]);}return e},u=function(){function o(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o);}}return function(e,t,n){return t&&o(e.prototype,t),n&&o(e,n),e}}();var r=function(e){function r(e){var t=1<arguments.length&&void 0!==arguments[1]?arguments[1]:{};!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,r);var n=function(e,t){if(!e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return !t||"object"!=typeof t&&"function"!=typeof t?e:t}(this,(r.__proto__||Object.getPrototypeOf(r)).call(this));if(n.element=a.a(e)?document.querySelector(e):e,!n.element)throw new Error("An invalid selector or non-DOM node has been provided.");return n._clickEvents=["click"],n.options=s({},i.a,t),n.element.dataset.hasOwnProperty("lowercase")&&(n.options.lowercase=n.element.dataset("lowercase")),n.element.dataset.hasOwnProperty("uppercase")&&(n.options.lowercase=n.element.dataset("uppercase")),n.element.dataset.hasOwnProperty("duplicates")&&(n.options.lowercase=n.element.dataset("duplicates")),n.init(),n}return function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function, not "+typeof t);e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),t&&(Object.setPrototypeOf?Object.setPrototypeOf(e,t):e.__proto__=t);}(r,o["a"]),u(r,[{key:"init",value:function(){if(!this.options.disabled){this.tags=[],this.container=document.createElement("div"),this.container.className="tagsinput",this.container.classList.add("field"),this.container.classList.add("is-grouped"),this.container.classList.add("is-grouped-multiline"),this.container.classList.add("input");var e=this.element.getAttribute("type");e&&"tags"!==e||(e="text"),this.input=document.createElement("input"),this.input.setAttribute("type",e),this.element.getAttribute("placeholder")?this.input.setAttribute("placeholder",this.element.getAttribute("placeholder")):this.input.setAttribute("placeholder","Add a Tag"),this.container.appendChild(this.input);var t=this.element.nextSibling;this.element.parentNode[t?"insertBefore":"appendChild"](this.container,t),this.element.style.cssText="position:absolute;left:0;top:0;width:1px;height:1px;opacity:0.01;",this.element.tabIndex=-1,this.enable();}}},{key:"enable",value:function(){var a=this;this.enabled||this.options.disabled||(this.element.addEventListener("focus",function(){a.container.classList.add("is-focused"),a.select(Array.prototype.slice.call(a.container.querySelectorAll(".tag:not(.is-delete)")).pop());}),this.input.addEventListener("focus",function(){a.container.classList.add("is-focused"),a.select(Array.prototype.slice.call(a.container.querySelectorAll(".tag:not(.is-delete)")).pop());}),this.input.addEventListener("blur",function(){a.container.classList.remove("is-focused"),a.select(Array.prototype.slice.call(a.container.querySelectorAll(".tag:not(.is-delete)")).pop()),a.savePartial();}),this.input.addEventListener("keydown",function(e){var t=e.charCode||e.keyCode||e.which,n=void 0,o=a.container.querySelector(".tag.is-active"),r=Array.prototype.slice.call(a.container.querySelectorAll(".tag:not(.is-delete)")).pop(),i=a.caretAtStart(a.input);if(o&&(n=a.container.querySelector('[data-tag="'+o.innerHTML.trim()+'"]')),a.setInputWidth(),13===t||t===a.options.delimiter.charCodeAt(0)||188===t||9===t){if(!a.input.value&&(t!==a.options.delimiter.charCodeAt(0)||188===t))return;a.savePartial();}else if(46===t&&n)n.nextSibling?a.select(n.nextSibling.querySelector(".tag")):n.previousSibling&&a.select(n.previousSibling.querySelector(".tag")),a.container.removeChild(n),a.tags.splice(a.tags.indexOf(n.getAttribute("data-tag")),1),a.setInputWidth(),a.save();else if(8===t)if(n)n.previousSibling?a.select(n.previousSibling.querySelector(".tag")):n.nextSibling&&a.select(n.nextSibling.querySelector(".tag")),a.container.removeChild(n),a.tags.splice(a.tags.indexOf(n.getAttribute("data-tag")),1),a.setInputWidth(),a.save();else {if(!r||!i)return;a.select(r);}else if(37===t)if(n)n.previousSibling&&a.select(n.previousSibling.querySelector(".tag"));else {if(!i)return;a.select(r);}else {if(39!==t)return a.select();if(!n)return;a.select(n.nextSibling.querySelector(".tag"));}return e.preventDefault(),!1}),this.input.addEventListener("input",function(){a.element.value=a.getValue(),a.element.dispatchEvent(new Event("input"));}),this.input.addEventListener("paste",function(){return setTimeout(savePartial,0)}),this.container.addEventListener("mousedown",function(e){a.refocus(e);}),this.container.addEventListener("touchstart",function(e){a.refocus(e);}),this.savePartial(this.element.value),this.enabled=!0);}},{key:"disable",value:function(){this.enabled&&!this.options.disabled&&(this.reset(),this.enabled=!1);}},{key:"select",value:function(e){var t=this.container.querySelector(".is-active");t&&t.classList.remove("is-active"),e&&e.classList.add("is-active");}},{key:"addTag",value:function(e){var i=this;if(~e.indexOf(this.options.delimiter)&&(e=e.split(this.options.delimiter)),Array.isArray(e))return e.forEach(function(e){i.addTag(e);});var t=e&&e.trim();if(!t)return !1;if("true"==this.options.lowercase&&(t=t.toLowerCase()),"true"==this.options.uppercase&&(t=t.toUpperCase()),this.options.duplicates||-1===this.tags.indexOf(t)){this.tags.push(t);var n=document.createElement("div");n.className="control",n.setAttribute("data-tag",t);var o=document.createElement("div");o.className="tags",o.classList.add("has-addons");var r=document.createElement("span");if(r.className="tag",r.classList.add("is-active"),this.select(r),r.innerHTML=t,o.appendChild(r),this.options.allowDelete){var a=document.createElement("a");a.className="tag",a.classList.add("is-delete"),this._clickEvents.forEach(function(e){a.addEventListener(e,function(e){var t=void 0,n=e.target.parentNode,o=Array.prototype.slice.call(i.container.querySelectorAll(".tag")).pop(),r=i.caretAtStart(i.input);if(n&&(t=i.container.querySelector('[data-tag="'+n.innerText.trim()+'"]')),t)i.select(t.previousSibling),i.container.removeChild(t),i.tags.splice(i.tags.indexOf(t.getAttribute("data-tag")),1),i.setInputWidth(),i.save();else {if(!o||!r)return;i.select(o);}});}),o.appendChild(a);}n.appendChild(o),this.container.insertBefore(n,this.input);}}},{key:"getValue",value:function(){return this.tags.join(this.options.delimiter)}},{key:"setValue",value:function(e){var t=this;Array.prototype.slice.call(this.container.querySelectorAll(".tag")).forEach(function(e){t.tags.splice(t.tags.indexOf(e.innerHTML),1),t.container.removeChild(e);}),this.savePartial(e);}},{key:"setInputWidth",value:function(){var e=Array.prototype.slice.call(this.container.querySelectorAll(".control")).pop();this.container.offsetWidth&&(this.input.style.width=Math.max(this.container.offsetWidth-(e?e.offsetLeft+e.offsetWidth:30)-30,this.container.offsetWidth/4)+"px");}},{key:"savePartial",value:function(e){"string"==typeof e||Array.isArray(e)||(e=this.input.value),!1!==this.addTag(e)&&(this.input.value="",this.save(),this.setInputWidth());}},{key:"save",value:function(){this.element.value=this.tags.join(this.options.delimiter),this.element.dispatchEvent(new Event("change"));}},{key:"caretAtStart",value:function(t){try{return 0===t.selectionStart&&0===t.selectionEnd}catch(e){return ""===t.value}}},{key:"refocus",value:function(e){return e.target.classList.contains("tag")&&this.select(e.target),e.target===this.input?this.select():(this.input.focus(),e.preventDefault(),!1)}},{key:"reset",value:function(){this.tags=[];}},{key:"destroy",value:function(){this.disable(),this.reset(),this.element=null;}}],[{key:"attach",value:function(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:'input[type="tags"]',t=1<arguments.length&&void 0!==arguments[1]?arguments[1]:{},n=new Array,o=document.querySelectorAll(e);return [].forEach.call(o,function(e){setTimeout(function(){n.push(new r(e,t));},100);}),n}}]),r}();t.a=r;},function(e,t,n){var o=function(){function o(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o);}}return function(e,t,n){return t&&o(e.prototype,t),n&&o(e,n),e}}();var r=function(){function t(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:[];!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,t),this._listeners=new Map(e),this._middlewares=new Map;}return o(t,[{key:"listenerCount",value:function(e){return this._listeners.has(e)?this._listeners.get(e).length:0}},{key:"removeListeners",value:function(){var t=this,e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null,n=1<arguments.length&&void 0!==arguments[1]&&arguments[1];null!==e?Array.isArray(e)?name.forEach(function(e){return t.removeListeners(e,n)}):(this._listeners.delete(e),n&&this.removeMiddleware(e)):this._listeners=new Map;}},{key:"middleware",value:function(e,t){var n=this;Array.isArray(e)?name.forEach(function(e){return n.middleware(e,t)}):(Array.isArray(this._middlewares.get(e))||this._middlewares.set(e,[]),this._middlewares.get(e).push(t));}},{key:"removeMiddleware",value:function(){var t=this,e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null;null!==e?Array.isArray(e)?name.forEach(function(e){return t.removeMiddleware(e)}):this._middlewares.delete(e):this._middlewares=new Map;}},{key:"on",value:function(e,t){var n=this,o=2<arguments.length&&void 0!==arguments[2]&&arguments[2];if(Array.isArray(e))e.forEach(function(e){return n.on(e,t)});else {var r=(e=e.toString()).split(/,|, | /);1<r.length?r.forEach(function(e){return n.on(e,t)}):(Array.isArray(this._listeners.get(e))||this._listeners.set(e,[]),this._listeners.get(e).push({once:o,callback:t}));}}},{key:"once",value:function(e,t){this.on(e,t,!0);}},{key:"emit",value:function(n,o){var r=this,i=2<arguments.length&&void 0!==arguments[2]&&arguments[2];n=n.toString();var a=this._listeners.get(n),s=null,u=0,c=i;if(Array.isArray(a))for(a.forEach(function(e,t){i||(s=r._middlewares.get(n),Array.isArray(s)?(s.forEach(function(e){e(o,function(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:null;null!==e&&(o=e),u++;},n);}),u>=s.length&&(c=!0)):c=!0),c&&(e.once&&(a[t]=null),e.callback(o));});-1!==a.indexOf(null);)a.splice(a.indexOf(null),1);}}]),t}();t.a=r;},function(e,t,n){t.a={disabled:!1,delimiter:",",allowDelete:!0,lowercase:!1,uppercase:!1,duplicates:!0};},function(e,t,n){n.d(t,"a",function(){return r});var o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},r=function(e){return "string"==typeof e||!!e&&"object"===(void 0===e?"undefined":o(e))&&"[object String]"===Object.prototype.toString.call(e)};}]).default});
    }(bulmaExtensions_min));

    /* app/pages/index/index.svelte generated by Svelte v3.44.2 */

    function create_fragment(ctx) {
    	let router;
    	let current;
    	router = new Router({ props: { routes }, $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(router.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(router, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(router, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Index', slots, []);
    	darkModeDetect();
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Index> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Router, routes, darkModeDetect });
    	return [];
    }

    class Index extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Index",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /**
     * Svelte Init
     * =====================
     * Create svelte app
     *
     * @contributors: Patryk Rzucidło [@ptkdev] <support@ptkdev.io> (https://ptk.dev)
     *
     * @license: MIT License
     *
     */
    const app = new Index({
        target: document.body,
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
