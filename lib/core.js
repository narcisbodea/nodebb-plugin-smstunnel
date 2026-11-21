'use strict';

// NodeBB's own modules, loaded when first used so the pure helpers can be tested without a forum.

const paths = {
	db: './src/database',
	meta: './src/meta',
	user: './src/user',
	posts: './src/posts',
	topics: './src/topics',
	categories: './src/categories',
	privileges: './src/privileges',
	routeHelpers: './src/routes/helpers',
	apiHelpers: './src/controllers/helpers',
	winston: 'winston',
	nconf: 'nconf',
};

const core = {};

Object.entries(paths).forEach(([name, path]) => {
	Object.defineProperty(core, name, {
		enumerable: true,
		get: () => require.main.require(path),
	});
});

// Logs carry a short reason only: never a number, a code, the words of a text or the key.
core.logProblem = (where, err) => {
	const reason = err && (err.code || err.name) ? String(err.code || err.name) : 'error';
	core.winston.warn(`[plugin/smstunnel] ${where}: ${reason.slice(0, 40)}`);
};

module.exports = core;
