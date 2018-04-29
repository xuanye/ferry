const logger = require('./logger.js')
const is = require('is')
const chalk = require('chalk')
const semver = require('semver')
const request = require('request')
const async = require('async')
const utils = require('./utils')
const localAssert = local => (boolean, type = 'error', msg, ...arg) =>
  logger.assert(boolean, type, msg, local, ...arg)
const assert = localAssert('core')
const packageConfig = require('../package.json')

const isObject = is.object,
  isArray = is.array,
  isFn = is.fn,
  isString = is.string,
  isEmpty = is.empty,
  isUndefined = is.undefined

/**
 * Export 'ferry'
 */
module.exports = Ferry

/**
 * Constructor
 * @param {Object} config configuration options
 * @param {Object|Array|String} opt publish options
 */
function Ferry(config, opt) {
  assert(
    semver.satisfies(process.version, packageConfig.engines.node),
    'error',
    `You must upgrade node to ${packageConfig.engines.node} to use ferry`
  )
  if (!(this instanceof Ferry)) return new Ferry(config, opt)
  this._middlewares = []
  this._initMetadata(config, opt)
  return this
}

Ferry.logger = logger

Ferry.mergeNoUndefined = function(val, ...arg) {
  for (let i = arg.length - 1; i != -1; i--) {
    if (!isUndefined(arg[i])) {
      val = arg[i]
      break
    }
  }
  return val
}

Ferry.extend = function(target = {}, ...source) {
  let options,
    name,
    src,
    copy,
    copyIsArray,
    clone,
    length = source.length

  for (let i = 0; i < length; i++) {
    if ((options = source[i]) != null) {
      for (name in options) {
        src = target[name]
        copy = options[name]
        if (target === copy) continue
        if (copy && (isObject(copy) || (copyIsArray = isArray(copy)))) {
          if (copyIsArray) {
            copyIsArray = false
            clone = src && isArray(src) ? src : []
          } else {
            clone = src && isObject(src) ? src : {}
          }
          target[name] = Ferry.extend(clone, copy)
        } else if (copy !== undefined) {
          target[name] = copy
        }
      }
    }
  }

  return target
}

/**
 * Init metadata
 * @param {Object} config configuration options
 * @param {Array|String} opt publish options
 * @return {Ferry}
 */
Ferry.prototype._initMetadata = function(config, opt) {
  assert(!isUndefined(config), 'error', 'Config is not found')
  assert(isObject(config), 'error', 'Config is not a object')
  assert(!isEmpty(config), 'error', 'Config cant not be an empty object')
  assert(
    !isUndefined(config.modules),
    'error',
    'Config option "modules" is required'
  )
  assert(
    isObject(config.modules) || isArray(config.modules),
    'error',
    'Config option "modules" must be a object or an array'
  )
  assert(
    !isEmpty(config.modules),
    'error',
    'Config option "modules" cant not be an empty object'
  )
  let modules = config.modules,
    replaceModules = {},
    pickArray
  if (isArray(modules))
    assert(
      modules.every(v => !isUndefined(v.env)),
      'error',
      'Publish option properties "env" is not found'
    )
  let deepCloneConfig = Ferry.extend({}, config)
  this._metadata = new Option()
  for (let i in deepCloneConfig) {
    if (i !== 'modules' && deepCloneConfig.hasOwnProperty(i)) {
      Option.prototype[i] = deepCloneConfig[i]
    }
  }
  if (isString(opt)) pickArray = [{ env: opt }]
  if (isArray(opt)) {
    pickArray = opt.map(v => {
      assert(
        isString(v) || isObject(v),
        'error',
        'The publish environment option you choice must be an object or a string'
      )
      return isString(v) ? { env: v } : v
    })
  }
  if (pickArray) {
    pickArray.forEach(v => {
      let obj = isArray(modules)
        ? modules.find(vv => vv.env === v.env)
        : modules[v.env]
      if (obj) {
        replaceModules[v.env] = Ferry.extend(new Option(obj), v)
      } else {
        logger.error(
          `The selected environment '${v.env}' does not exist`,
          'core'
        )
      }
    })
  } else {
    if (isArray(modules)) {
      modules.forEach(v => {
        replaceModules[v.env] = new Option(v)
      })
    } else {
      for (let i in modules) {
        replaceModules[i] = new Option(modules[i])
      }
    }
  }
  this._metadata.modules = replaceModules
  return this

  /**
   * Option constructor
   * @param {Object} obj option
   */
  function Option(obj) {
    if (isObject(obj)) {
      for (let i in obj) {
        if (obj.hasOwnProperty(i)) {
          this[i] = obj[i]
        }
      }
    }
  }
}

/**
 * Return metadata or set metadata
 * @param  {Object} metadata
 * @return {Ferry|Object}
 */
Ferry.prototype.metadata = function(metadata) {
  if (!arguments.length) return this._metadata
  assert(isObject(metadata), 'error', 'You must pass a metadata object')
  Ferry.extend(this._metadata, metadata)
  return this
}

/**
 * Use middleware
 * @param  {Function} middleware
 * @return {Ferry}
 */
Ferry.prototype.use = function(middleware) {
  assert(arguments.length, 'error', 'You must pass a middleware function')
  assert(isFn(middleware), 'error', 'Middleware must be a function')
  assert(middleware.name, 'error', 'Middleware must be a named function')
  this._middlewares.push(middleware)
  return this
}

/**
 * Adjusting Middleware
 * @return {Ferry}
 */
Ferry.prototype._adjustModuleMiddlewares = function() {
  let { modules } = this._metadata
  let _middlewares = this._middlewares
  for (let i in modules) {
    let module = modules[i]
    let {
      beforeHooks,
      afterHooks,
      middlewareReplace,
      middlewareUse,
      middlewareIgnore
    } = module
    let moduleMiddlewares = _middlewares.slice()
    let middlewaresNameArr = _middlewares.map(v => v.name)
    if (middlewareUse) {
      if (isString(middlewareUse)) middlewareUse = [middlewareUse]
      middlewareUse.forEach(v => {
        assert(
          middlewaresNameArr.includes(v),
          'error',
          `Cannot found middleware '${v}' to use`
        )
      })
      moduleMiddlewares = moduleMiddlewares.filter(v =>
        middlewareUse.includes(v.name)
      )
    }
    if (middlewareIgnore) {
      if (isString(middlewareIgnore)) middlewareIgnore = [middlewareIgnore]
      middlewareIgnore.forEach(v => {
        assert(
          middlewaresNameArr.includes(v),
          'error',
          `Cannot found middleware '${v}' to ignore`
        )
        moduleMiddlewares = moduleMiddlewares.filter(vv => vv.name !== v)
      })
    }
    if (middlewareReplace) {
      if (isObject(middlewareReplace)) middlewareReplace = [middlewareReplace]
      middlewareReplace.forEach(v => {
        let { name, middleware: newMiddleware } = v
        assert(
          isString(name),
          'error',
          'You must pass a name of the old middleware to replace'
        )
        assert(
          isFn(newMiddleware),
          'error',
          'New middleware must be a function'
        )
        assert(
          newMiddleware.name && newMiddleware.name !== 'middleware',
          'error',
          'New middleware must hava a name, otherwise the hook function cannot mount'
        )
        let index = moduleMiddlewares.findIndex(v => v.name === name)
        assert(~index, 'error', `Cannot found middleware '${name}' to replace`)
        moduleMiddlewares.splice(index, 1, newMiddleware)
      })
    }
    let dealHook = function(hooks, direction) {
      if (isObject(hooks)) hooks = [hooks]
      return hooks.forEach(v => {
        let { when, fn } = v
        assert(
          isString(when),
          'error',
          "Hook function must hava a key 'when' to tell Ferry when to use this hook"
        )
        assert(isFn(fn), 'error', 'You must pass a function as a hook function')
        let index = moduleMiddlewares.findIndex(vv => v.when === vv.name)
        assert(
          ~index,
          'error',
          `The hook function mount middleware "${v.when}" was not found`
        )
        moduleMiddlewares.splice(
          index + (direction === 'before' ? 0 : 1),
          0,
          v.fn
        )
      })
    }
    if (beforeHooks) dealHook(beforeHooks, 'before')
    if (afterHooks) dealHook(afterHooks, 'after')
    module._moduleMiddlewares = moduleMiddlewares
  }
  return this
}

/**
 * Perform asynchronous tasks using the 'async' module
 * https://caolan.github.io/async/
 * @return {Ferry}
 */
Ferry.prototype.start = function(adjust) {
  if (this._metadata.startHook) this._metadata.startHook(this)
  if (adjust) this._adjustModuleMiddlewares()
  let { modules, parallel, completeHook, checkUpdate = true } = this._metadata
  assert(
    !isEmpty(modules),
    'error',
    'The publish environments you choice is not found'
  )
  let { error, success } = logger
  console.time('Total time-consuming')
  async[parallel ? 'concat' : 'concatSeries'](
    Object.keys(modules),
    async.reflect((key, callback) => {
      modules[key]._timeStamp = utils.formatDate(new Date(),'yyyyMMddHHmmssS');
      // async.series(this._middlewares.map(v => next => v.bind(this, modules[key], key, next)()), callback);
      let tasks = adjust ? modules[key]._moduleMiddlewares : this._middlewares
      async.series(
        tasks.map(v => async.apply(v.bind(this), modules[key], key)),
        callback
      )
    }),
    (err, result) => {
      if (completeHook) completeHook(this, result)
      if (err) logger.error('core')
      logger.log(`mission completed, end time ${utils.formatDate(new Date(),'yyyy-MM-dd HH:mm:ss')}`)
      console.timeEnd('Total time-consuming')
      if (checkUpdate) this.checkUpdate()
    }
  )
  return this
}

/**
 * check update
 * @return {Ferry}
 */
Ferry.prototype.checkUpdate = function() {
  request(
    {
      url: 'https://registry.npmjs.org/ferryjs',
      timeout: 1000
    },
    (err, res, body) => {
      if (!err && res.statusCode === 200) {
        let latestVersion = JSON.parse(body)['dist-tags'].latest
        let localVersion = packageConfig.version
        if (semver.lt(localVersion, latestVersion)) {
          console.log()
          console.log(
            chalk.yellow('A newer version of ferry is available.')
          )
          console.log()
          console.log('  latest:    ' + chalk.green(latestVersion))
          console.log('  installed: ' + chalk.red(localVersion))
          console.log()
          console.log(
            "Visit 'https://github.com/xuanye/ferry/releases' for more update information"
          )
          console.log()
        }
      }
    }
  )
  return this
}

process.on('uncaughtException', err => {
  return Ferry.logger.error(err.stack, 'uncaughtException')
})
process.on('unhandledRejection', err => {
  return Ferry.logger.error(err.stack, 'unhandledRejection')
})
