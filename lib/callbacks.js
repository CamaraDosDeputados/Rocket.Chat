import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

export const callbacks = {};

callbacks.logger = null;
callbacks.timed = false;

const wrapCallback = (callback) => (...args) => {
	const time = Date.now();
	const result = callback(...args);
	const currentTime = Date.now() - time;
	let stack = callback.stack
		&& typeof callback.stack.split === 'function'
		&& callback.stack.split('\n');
	stack = stack && stack[2] && (stack[2].match(/\(.+\)/) || [])[0];
	console.log(String(currentTime), callback.hook, callback.id, stack);
	return result;
};

const wrapRun = (hook, fn) => (...args) => {
	const time = Date.now();
	const ret = fn(...args);
	const totalTime = Date.now() - time;
	console.log(`${ hook }:`, totalTime);
	return ret;
};

const handleResult = (fn) => (result, constant) => {
	callbacks.logger && callbacks.logger.debug(`Executing callback with id ${ fn.id } for hook ${ fn.hook }`);
	const callbackResult = callbacks.runItem({ hook: fn.hook, callback: fn, result, constant });
	return typeof callbackResult === 'undefined' ? result : callbackResult;
};


const identity = (e) => e;
const pipe = (f, g) => (e, ...constants) => g(f(e, ...constants), ...constants);
const createCallback = (hook, callbacks) => callbacks.map(handleResult).reduce(pipe, identity);

const createCallbackTimed = (hook, callbacks) =>
	wrapRun(hook,
		callbacks
			.map(wrapCallback)
			.map(handleResult)
			.reduce(pipe, identity),
	);

const create = (hook, cbs) =>
	(callbacks.timed ? createCallbackTimed(hook, cbs) : createCallback(hook, cbs));
const combinedCallbacks = new Map();

/*
* Callback priorities
* @enum {CallbackPriority}
*/
callbacks.priority = {
	HIGH: -1000,
	MEDIUM: 0,
	LOW: 1000,
};

const getHooks = (hookName) => callbacks[hookName] || [];

/*
* Add a callback function to a hook
* @param {String} hook - The name of the hook
* @param {Function} callback - The callback function
* @param {CallbackPriority} priority - The callback run priority (order)
* @param {String} id - Human friendly name for this callback
*/
callbacks.add = function(
	hook,
	callback,
	priority = callbacks.priority.MEDIUM,
	id = Random.id(),
) {
	callbacks[hook] = getHooks(hook);
	if (callbacks[hook].find((cb) => cb.id === id)) {
		return;
	}
	callback.hook = hook;
	callback.priority = priority;
	callback.id = id;
	callback.stack = new Error().stack;

	callbacks[hook].push(callback);
	callbacks[hook] = callbacks[hook].sort(({ priority: a }, { priority: b }) => (a || callbacks.priority.MEDIUM) - (b || callbacks.priority.MEDIUM));
	combinedCallbacks.set(hook, create(hook, callbacks[hook]));
};


/*
* Remove a callback from a hook
* @param {string} hook - The name of the hook
* @param {string} id - The callback's id
*/

callbacks.remove = function(hook, id) {
	callbacks[hook] = getHooks(hook).filter((callback) => callback.id !== id);
	combinedCallbacks.set(hook, create(hook, callbacks[hook]));
};

callbacks.runItem = ({ callback, result, constant /* , hook */ }) => callback(result, constant);

/*
* Successively run all of a hook's callbacks on an item
* @param {String} hook - The name of the hook
* @param {Object} item - The post, comment, modifier, etc. on which to run the callbacks
* @param {Object} [constant] - An optional constant that will be passed along to each callback
* @returns {Object} Returns the item after it's been through all the callbacks for this hook
*/

callbacks.run = function(hook, item, constant) {
	const runner = combinedCallbacks.get(hook);
	if (!runner) {
		return item;
	}

	return runner(item, constant);

	// return callbackItems.reduce(function(result, callback) {
	// 	const callbackResult = callbacks.runItem({ hook, callback, result, constant });

	// 	return typeof callbackResult === 'undefined' ? result : callbackResult;
	// }, item);
};


/*
* Successively run all of a hook's callbacks on an item, in async mode
* @param {String} hook - The name of the hook
* @param {Object} item - The post, comment, modifier, etc. on which to run the callbacks
* @param {Object} [constant] - An optional constant that will be passed along to each callback
*/
callbacks.runAsync = (hook, item, constant) => {
	const callbackItems = callbacks[hook];
	if (callbackItems?.length) {
		callbackItems.forEach((callback) => Meteor.defer(() => callback(item, constant)));
	}
	return item;
};