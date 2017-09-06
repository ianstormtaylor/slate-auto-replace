
import typeOf from 'type-of'

/**
 * A Slate plugin to automatically replace a block when a string of matching
 * text is typed.
 *
 * @param {Object} opts
 * @return {Object}
 */

function AutoReplace(opts = {}) {
  const { transform } = opts
  const trigger = normalizeTrigger(opts.trigger)
  let ignoreIn
  let onlyIn

  if (opts.ignoreIn) ignoreIn = normalizeMatcher(opts.ignoreIn)
  if (opts.onlyIn) onlyIn = normalizeMatcher(opts.onlyIn)

  if (!transform) throw new Error('You must provide a `transform` option.')
  if (!trigger) throw new Error('You must provide a `trigger` option.')

  /**
   * On before input.
   *
   * @param {Event} e
   * @param {Object} data
   * @param {Change} change
   * @param {Editor} editor
   * @return {State}
   */

  function onBeforeInput(e, data, change, editor) {
    if (trigger(e, data)) {
      return replace(e, data, change, editor)
    }
  }

  /**
   * On key down.
   *
   * @param {Event} e
   * @param {Object} data
   * @param {Change} change
   * @param {Editor} editor
   * @return {State}
   */

  function onKeyDown(e, data, change, editor) {
    // Don't waste cycles checking regexs or characters, since they should be
    // handled in the `onBeforeInput` handler instead.
    if (typeOf(opts.trigger) == 'regexp') return
    if (typeOf(opts.trigger) == 'string' && opts.trigger.length == 1) return

    if (trigger(e, data, { key: true })) {
      return replace(e, data, change, editor)
    }
  }

  /**
   * Replace a block's properties.
   *
   * @param {Event} e
   * @param {Object} data
   * @param {Change} change
   * @param {Editor} editor
   * @return {State}
   */

  function replace(e, data, change, editor) {
    const { state } = change
    if (state.isExpanded) return

    const block = state.startBlock
    const type = block.type
    if (onlyIn && !onlyIn(type)) return
    if (ignoreIn && ignoreIn(type)) return

    const matches = getMatches(state)
    if (!matches) return

    e.preventDefault()

    let startOffset = state.startOffset
    let totalRemoved = 0
    const offsets = getOffsets(matches, startOffset)

    offsets.forEach((offset) => {
      change
        .moveOffsetsTo(offset.start, offset.end)
        .delete()
      totalRemoved += offset.total
    })

    startOffset -= totalRemoved
    change.moveOffsetsTo(startOffset, startOffset)

    return change.call(transform, e, data, matches, editor)
  }

  /**
   * Try to match the current text of a `state` with the `before` and
   * `after` regexes.
   *
   * @param {State} state
   * @return {Object}
   */

  function getMatches(state) {
    const { startText, startOffset } = state
    const { text } = startText
    let after = null
    let before = null

    if (opts.after) {
      const string = text.slice(startOffset)
      after = string.match(opts.after)
    }

    if (opts.before) {
      const string = text.slice(0, startOffset)
      before = string.match(opts.before)
    }

    // If both sides, require that both are matched, otherwise null.
    if (opts.before && opts.after && !before) after = null
    if (opts.before && opts.after && !after) before = null

    // Return null unless we have a match.
    if (!before && !after) return null

    if (after) after[0] = after[0].replace(/\s+$/, '')
    if (before) before[0] = before[0].replace(/^\s+/, '')

    return { before, after }
  }

  /**
   * Return the offsets for `matches` with `start` offset.
   *
   * @param {Object} matches
   * @param {Number} start
   * @return {Object}
   */

  function getOffsets(matches, start) {
    const { before, after } = matches
    let end = start
    let offsets = []
    let totalRemoved = 0

    if (before) {
      let match = before[0]
      let startOffset = 0
      let matchIndex = 0

      before.slice(1, before.length).forEach((current) => {
        if(current === undefined) return

        matchIndex = match.indexOf(current, matchIndex)
        startOffset = start - totalRemoved + matchIndex - match.length

        offsets.push({
          start: startOffset,
          end: startOffset + current.length,
          total: current.length
        })

        totalRemoved += current.length
        matchIndex += current.length
      })
    }

    if(after) {
      let match = after[0]
      let startOffset = 0
      let matchIndex = 0

      after.slice(1, after.length).forEach((current) => {
        if(current === undefined) return

        matchIndex = match.indexOf(current, matchIndex)
        startOffset = start - totalRemoved + matchIndex

        offsets.push({
          start: startOffset,
          end: startOffset + current.length,
          total: 0
        })

        totalRemoved += current.length
        matchIndex += current.length
      })
    }

    return offsets
  }

  /**
   * Return the plugin.
   *
   * @type {Object}
   */

  return {
    onBeforeInput,
    onKeyDown,
  }
}

/**
 * Normalize a `trigger` option to a matching function.
 *
 * @param {Mixed} trigger
 * @return {Function}
 */

function normalizeTrigger(trigger) {
  switch (typeOf(trigger)) {
    case 'function':
      return trigger
    case 'regexp':
      return (e, data) => {
        return !!(e.data && e.data.match(trigger))
      }
    case 'string':
      return (e, data, opts = {}) => {
        return opts.key
          ? data.key == trigger
          : e.data == trigger
      }
  }
}

/**
 * Normalize a node matching plugin option.
 *
 * @param {Function || Array || String} matchIn
 * @return {Function}
 */

function normalizeMatcher(matcher) {
  switch (typeOf(matcher)) {
    case 'function':
      return matcher
    case 'array':
      return node => matcher.includes(node)
    case 'string':
      return node => node == matcher
  }
}

/**
 * Export.
 *
 * @type {Function}
 */

export default AutoReplace
