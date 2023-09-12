/**
 * CTRE v3.0.1
 * by blade.sk
 */
const ctre = {
  hoveredElement: null,
  markedElement: null,
  previewedHiddenSelector: null,
  targetingMode: false,
  transpose: 0, // how far to travel up the line of ancestors
  maxZIndex: 2147483647,
  hiddenElements: [],
  settings: {},

  helpWindow: null,

  $: function (query) {
    if (!this.helpWindow) return null
    return this.helpWindow.shadowRoot.querySelector(query)
  },

  $$: function (query) {
    if (!this.helpWindow) return null
    return this.helpWindow.shadowRoot.querySelectorAll(query)
  },

  triggerResize: function () {
    let evt = document.createEvent("UIEvents")
    evt.initUIEvent("resize", true, false, window, 0)
    window.dispatchEvent(evt)

    setTimeout(function () {
      // also update overlays
      ctre.refreshOverlays()
    })
  },

  highlightElement: function () {
    if (!ctre.hoveredElement) return

    if (ctre.markedElement) {
      ctre.removeHighlightStyle(ctre.markedElement)
    }

    ctre.markedElement = ctre.hoveredElement
    if (ctre.markedElement.className == "ctre_overlay") {
      // this is just a proxy for an iframe
      ctre.markedElement = ctre.markedElement.relatedElement
    }

    let i = 0
    for (i = 0; i < ctre.transpose; i++) {
      if (ctre.markedElement.parentNode != window.document) {
        ctre.markedElement = ctre.markedElement.parentNode
      } else {
        break
      }
    }

    ctre.transpose = i
    ctre.addHighlightStyle(ctre.markedElement)

    ctre.$("#ctre_current_elm").innerHTML = ctre.getPathHTML(
      ctre.hoveredElement,
      ctre.transpose
    )
    ctre.$("#ctre_current_elm .pathNode.active").scrollIntoView()
    // ctre.$('#ctre_current_elm').scrollTop = 9999
  },

  unhighlightElement: function () {
    if (!ctre.markedElement) return

    ctre.removeHighlightStyle(ctre.markedElement)
    ctre.markedElement = null
    ctre.hoveredElement = null
    ctre.$("#ctre_current_elm").innerHTML = "Select an element with the mouse"
  },

  addHighlightStyle: function (elm) {
    ctre.markedElement.style.setProperty(
      "outline",
      "solid 5px rgba(255,0,0,0.5)",
      "important"
    )
    ctre.markedElement.style.outlineOffset = "-5px"
  },

  removeHighlightStyle: function (elm) {
    ctre.markedElement.style.outline = ""
    ctre.markedElement.style.outlineOffset = ""
  },

  mouseover: function (e) {
    if (ctre.isChildOfCTREWindow(e.target)) {
      // ctre.unhighlightElement() // causes bugs when the mouse comes from the top
      return
    }

    if (ctre.hoveredElement != e.target) {
      ctre.transpose = 0
      ctre.hoveredElement = e.target
      ctre.highlightElement()
    }
  },

  isChildOfCTREWindow: function (elm) {
    for (var i = 0; i < 8; i++) {
      if (elm == ctre.helpWindow) return true
      elm = elm.parentNode
      if (!elm) break
    }

    return false
  },

  keyDown: function (e) {
    if (!ctre.targetingMode) return

    if (e.code == "Escape") {
      ctre.deactivate()
    } else if (e.code == "Space") {
      if (ctre.markedElement) ctre.hideTarget()
    } else if (e.code == "KeyW") {
      if (ctre.transpose > 0) ctre.transpose--
      ctre.highlightElement()
    } else if (e.code == "KeyQ") {
      ctre.transpose++
      ctre.highlightElement()
    }

    e.stopPropagation()
    e.preventDefault()
  },

  keyUp: function (e) {
    if (!ctre.targetingMode) return

    e.stopPropagation()
    e.preventDefault()
  },

  hideTarget: function (mouseEvt /* optional */) {
    if (mouseEvt && ctre.isChildOfCTREWindow(mouseEvt.target)) return

    let selector = ctre.getSelector(ctre.markedElement)
    if (!selector) return

    if (!selector || (mouseEvt && mouseEvt.button !== 0)) {
      mouseEvt?.preventDefault()
      mouseEvt?.stopPropagation()
      return
    }

    ctre.unhighlightElement()

    ctre.hiddenElements.push({
      selector,
      permanent: !!ctre.settings.remember,
    })

    ctre.updateCSS()
    ctre.updateElementList()
    ctre.triggerResize()
    ctre.refreshOverlays()
    ctre.updateSavedElements()

    mouseEvt?.preventDefault()
    mouseEvt?.stopPropagation()
  },

  getSelector: function (element) {
    if (element.tagName == "BODY") return "body"
    if (element.tagName == "HTML") return "html"
    if (!element) return null

    return cssFinder(element, {
      // seedMinLength: 3,
      // optimizedMinLength: 1,
    })
  },

  getPathHTML: function (element, transpose) {
    function getElmName(elm) {
      if (elm.id) {
        return "#" + elm.id
      } else if (
        typeof elm.className == "string" &&
        elm.className.trim().length
      ) {
        return (
          elm.tagName.toLowerCase() +
          "." +
          elm.className.trim().split(" ").join(".")
        )
      } else {
        return elm.tagName.toLowerCase()
      }
    }

    let path = []
    let currentElm = element

    if (currentElm.className == "ctre_overlay") {
      // this is just a proxy for an iframe
      currentElm = currentElm.relatedElement
    }

    while (currentElm) {
      path.push(currentElm)
      currentElm = currentElm.parentElement
    }

    path = path.reverse()

    let html = []
    for (let i = 0; i < path.length; i++) {
      html.push(
        `<span class="pathNode${
          path.length - 1 - i == transpose ? " active" : ""
        }">${getElmName(path[i])}</span>`
      )
    }

    return html.join(" > ")
  },

  preventEvent: function (e) {
    if (ctre.isChildOfCTREWindow(e.target)) return

    e.preventDefault()
    e.stopPropagation()
    return false
  },

  updateCSS: function () {
    let cssLines = [
      `
			#ctre_wnd {
				position: fixed; top: 10px; right: 5px;
			    width: fit-content !important;
  				height: fit-content !important;
				background: #0f172a; box-shadow: 0px 0px 40px rgba(0,0,0,0.15);
        color:white;
				border-radius: 12px;
        border:2px solid #2a8682;
				z-index: ${ctre.maxZIndex};
			}
			`,
    ]

    for (let i in ctre.hiddenElements) {
      let selector = ctre.hiddenElements[i].selector
      if (selector == ctre.previewedHiddenSelector) {
        cssLines.push(
          selector +
            " { outline: solid 5px rgba(0,214,255,0.5) !important; outline-offset: -5px; }"
        )
      } else if (selector == "body" || selector == "html") {
        cssLines.push(selector + " { background: transparent !important; }")
      } else {
        cssLines.push(selector + " { display: none !important; }")
      }
    }

    if (ctre.hiddenElements.some((elm) => elm.selector.match(/\*|#ctre/))) {
      cssLines.push(
        `
				html, body, html body > #ctre_wnd { /* safeguard against "*" rules */
					display: block !important;
				}
				`
      )
    }

    let styleElm = document.querySelector("#ctre_styles")
    if (!styleElm) {
      styleElm = document.createElement("style")
      styleElm.type = "text/css"
      styleElm.id = "ctre_styles"
      document.head.appendChild(styleElm)
    }

    while (styleElm.firstChild) {
      styleElm.removeChild(styleElm.firstChild)
    }

    styleElm.appendChild(document.createTextNode(cssLines.join("\n")))
  },

  updateElementList: function () {
    if (!ctre.helpWindow) return

    let elmList = ctre.$("#ctre_elm_list")
    let lines = []

    if (ctre.hiddenElements.length) {
      lines.push(
        '<div class="table"><div class="ct_tr ct_heading row heading" ><div class="cell">Removed element</div><div class="cell">Remember?</div><div class="cell"></div></div>'
      )

      for (let elm of ctre.hiddenElements) {
        lines.push(`
        
        <div class="row ct_tr" >
          <div class="ct_selector cell"><a href="" class="ct_edit_selector">edit</a>${escapeHTML(
            elm.selector
          )}</div>
					<div class="cell"><input type="checkbox"${
            elm.permanent ? " checked" : ""
          }></div>
					<div class="cell actions"><span class="ct_preview">👁</span> <a href="" class="ct_delete">✖</a></div>
				</div>

        `)
      }

      lines.push("</div>")
      elmList.classList.add("hasContent")
    } else {
      elmList.classList.remove("hasContent")
    }
    // if (ctre.hiddenElements.length) {
    //   lines.push(
    //     '<table><tr class="ct_heading" style="padding:6px 0;"><td>Removed element</td><td>Remember?</td><td></td></tr>'
    //   )

    //   for (let elm of ctre.hiddenElements) {
    //     lines.push(`

    //     <tr class="ct_tr">
    //       <td class="ct_selector"><a href="" class="ct_edit_selector">edit</a>${escapeHTML(
    //         elm.selector
    //       )}</td>
    // 			<td><input type="checkbox"${elm.permanent ? " checked" : ""}></td>
    // 			<td><span class="ct_preview">👁</span> <a href="" class="ct_delete">✖</a></td>
    // 		</tr>

    //     `)
    //   }

    //   lines.push("</table>")
    //   elmList.classList.add("hasContent")
    // } else {
    //   elmList.classList.remove("hasContent")
    // }

    elmList.innerHTML = lines.join("\n")

    function onChangePermanent() {
      var tr = closest(this, ".ct_tr")
      let index = ctre.hiddenElements.findIndex(
        (elm) => elm.selector == tr.selector
      )
      var hiddenElement = ctre.hiddenElements[index]
      hiddenElement.permanent = this.checked

      ctre.updateSavedElements()
    }

    function onDeleteClick(e) {
      let tr = closest(this, ".ct_tr")

      if (tr.selector) {
        let index = ctre.hiddenElements.findIndex(
          (elm) => elm.selector == tr.selector
        )
        ctre.hiddenElements.splice(index, 1)
      }

      ctre.updateCSS()
      ctre.refreshOverlays()
      ctre.updateElementList()
      ctre.updateSavedElements()

      e.preventDefault()
      e.stopPropagation()
    }

    function onPreviewHoverOn(e) {
      let selector = closest(this, ".ct_tr").selector
      if (!selector) return

      ctre.previewedHiddenSelector = selector
      ctre.updateCSS()
    }

    function onPreviewHoverOff(e) {
      let selector = closest(this, ".ct_tr").selector
      if (!selector) return

      if (ctre.previewedHiddenSelector == selector) {
        ctre.previewedHiddenSelector = null
        ctre.updateCSS()
      }
    }

    function onEditSelector(e) {
      e.preventDefault()
      e.stopPropagation()

      let tr = closest(this, ".ct_tr")

      if (tr.selector) {
        let hiddenElement = ctre.hiddenElements.find(
          (elm) => elm.selector == tr.selector
        )
        let newSelector = prompt(
          'Customize CSS selector\n\nhints:\n[id^="Abc"] matches #AbcWhatever\n[class*="Abc"] matches .somethingAbcSomething',
          hiddenElement.selector
        )
        if (newSelector) {
          hiddenElement.selector = newSelector

          ctre.updateCSS()
          ctre.refreshOverlays()
          ctre.updateElementList()
          ctre.updateSavedElements()
        }
      }
    }

    let i = -1
    for (let tr of ctre.$$("#ctre_elm_list .ct_tr")) {
      // for (let tr of ctre.$$("#ctre_elm_list table tr")) {
      if (i < 0) {
        // skip heading
        i++
        continue
      }

      tr.selector = ctre.hiddenElements[i].selector

      tr.querySelector("input").addEventListener(
        "change",
        onChangePermanent,
        false
      )

      let inpu = tr.querySelector("input")
      console.log("inpu: ", inpu)
      tr.querySelector("a.ct_delete").addEventListener(
        "click",
        onDeleteClick,
        false
      )
      tr.querySelector(".ct_preview").addEventListener(
        "mouseenter",
        onPreviewHoverOn,
        false
      )
      tr.querySelector(".ct_preview").addEventListener(
        "mouseleave",
        onPreviewHoverOff,
        false
      )
      tr.querySelector("a.ct_edit_selector").addEventListener(
        "click",
        onEditSelector,
        false
      )

      i++
    }
  },

  updateSavedElements: function () {
    chrome.runtime.sendMessage({
      action: "set_saved_elms",
      website: location.hostname.replace(/^www\./, ""),
      data: JSON.stringify(ctre.hiddenElements.filter((elm) => elm.permanent)),
    })
  },

  loadSavedElements: function () {
    chrome.runtime.sendMessage(
      {
        action: "get_saved_elms",
        website: location.hostname.replace(/^www\./, ""),
      },
      function (data) {
        ctre.hiddenElements = JSON.parse(data)

        ctre.updateCSS()
        ctre.updateElementList()
      }
    )

    chrome.runtime.sendMessage(
      {
        action: "get_settings",
      },
      function (data) {
        ctre.settings = JSON.parse(data)
      }
    )
  },

  updateSettings: function () {
    ctre.$("#ctre_opt_remember").textContent = ctre.settings.remember
      ? "yes"
      : "no"
  },

  saveSettings: function () {
    chrome.runtime.sendMessage({
      action: "set_settings",
      data: JSON.stringify(ctre.settings),
    })
  },
  //

  //
  activate: function () {
    if (!ctre.helpWindow) ctre.updateCSS()

    let shadowElm = document.createElement("div")
    shadowElm.setAttribute("id", "ctre_wnd")
    // shadowElm.addEventListener("mousedown", dragStart)

    //agregar event listener para moverlo.
    shadowElm.attachShadow({ mode: "open" })
    shadowElm.style.visibility = "hidden"
    document.body.appendChild(shadowElm)

    ctre.helpWindow = shadowElm

    shadowElm.shadowRoot.innerHTML = `
			<link rel="stylesheet" href="${chrome.runtime.getURL("content.css")}">
			<div class="ct_root">

        <div id="dragButton" class="drag-button" style="border-radius:8px; width: 25px; height: 25px; background-color: #2a8682; position: absolute; top: -3px; left: -3px; cursor: move; display: flex; justify-content: center; align-items: center;">
          <span style="font-size: 16px; cursor: move;">↖</span>
        </div>

				<span class="ct_logo">
        <span style="text-align:center; display:block;">Click to remove distraction</span>
					
				<span class="ct_logo small">CTRE</span>
				<div class="ct_close">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="plain-icon-color stroke-[1.5]"><path d="M18 6l-12 12"></path><path d="M6 6l12 12"></path></svg>
        </div>
				<div id="ctre_current_elm">Select an element with the mouse</div>
				
				<div class="settingsRow">
					<div>
						Remember by default: <a href="" id="ctre_opt_remember">?</a>
					</div>
				</div>
        

				<div class="ct_separator" ></div>
				<div id="ctre_elm_list"></div>
        
				<div class="ct_more">
					Modified by <a href="https://twitter.com/js_segu" target="_blank" rel="nofollow">@js_segu</a>.
					Originally created by: <a href="https://blade.sk" target="_blank" rel="nofollow">blade.sk</a>
				</div>
			</div>
		`
    //     shadowElm.shadowRoot.innerHTML = `
    // 			<link rel="stylesheet" href="${chrome.runtime.getURL("content.css")}">
    // 			<div class="ct_root">

    //  <div  id="dragButton" class="drag-button" style="border-radius:8px; width: 20px; height: 20px; background-color: #ddd; position: absolute; top: -3px; left: -3px; cursor: move; display: flex; justify-content: center; align-items: center;">
    //       <span style="font-size: 16px; cursor: move;">↖</span>
    //     </div>

    // 				<span class="ct_logo">Click to remove element
    // 					<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="16" height="16" viewBox="-300 -300 600 600">
    // 					<circle r="50"/>
    // 					<path d="M75,0 A 75,75 0 0,0 37.5,-64.952 L 125,-216.506 A 250,250 0 0,1 250,0 z" id="bld"/>
    // 					<use xlink:href="#bld" transform="rotate(120)"/>
    // 					<use xlink:href="#bld" transform="rotate(240)"/>
    // 					</svg>
    // 				</span> <span class="version">v3.0.1</span>
    // 				<span class="ct_logo small">CTRE</span>
    // 				<div class="ct_minimize"><i>➜</i></div>
    // 				<div class="ct_close">✖</div>
    // 				<div id="ctre_current_elm">Select an element with the mouse</div>
    // 				<div class="settingsRow">
    // 					<div class="activationKeys" title="Click to change">
    // 						Activation hotkey not set
    // 					</div>
    // 					<div>
    // 						<span class="key">Q</span>/<span class="key">W</span>: move up or down one level
    // 					</div>
    // 				</div>
    // 				<div class="settingsRow">
    // 					<div>
    // 						Remember by default: <a href="" id="ctre_opt_remember">?</a>
    // 					</div>
    // 					<div>
    // 						<span class="key">SPACE</span>: remove element (when unable to click)
    // 					</div>
    // 				</div>
    // 				<div class="ct_separator"></div>
    // 				<div id="ctre_elm_list"></div>
    // 				<div class="ct_more">
    // 					Made by <a href="https://blade.sk/?utm_source=ctre" target="_blank" rel="nofollow">blade.sk</a>.
    // 					Check out my other projects: <a href="https://keyboard.cool/?utm_source=ctre" target="_blank" rel="nofollow">keyboard.cool</a>
    // 				</div>
    // 			</div>
    // 		`

    const dragButton = shadowElm.shadowRoot.querySelector("#dragButton")
    dragButton.addEventListener("mousedown", dragStart)

    function dragStart(e) {
      const rootElm = shadowElm // Directly use the shadowElm variable

      if (!rootElm) {
        console.error("Root element not found")
        return
      }

      offsetX = e.clientX - rootElm.getBoundingClientRect().left
      offsetY = e.clientY - rootElm.getBoundingClientRect().top

      document.addEventListener("mousemove", dragMove)
      document.addEventListener("mouseup", dragEnd)
    }

    function dragMove(e) {
      const x = e.clientX - offsetX
      const y = e.clientY - offsetY

      // Notice we are using shadowElm directly here, as it represents #ctre_wnd
      shadowElm.style.left = `${x}px`
      shadowElm.style.top = `${y}px`
    }

    function dragEnd() {
      document.removeEventListener("mousemove", dragMove)
      document.removeEventListener("mouseup", dragEnd)
    }

    ctre.$("link").addEventListener("load", () => {
      // prevent "flash of unstyled content" in the shadow DOM
      shadowElm.style.visibility = "visible"
    })

    // chrome.runtime.sendMessage({ action: "get_hotkey" }, (hotkey) => {
    //   if (!hotkey) return

    //   let keys = hotkey.split(/\+/)
    //   let elm = ctre.$(".activationKeys")
    //   let html = [
    //     ...keys.map((key) => `<span class="key">${key}</span>`),
    //     " : toggle CTRE",
    //   ]

    //   if (elm) elm.innerHTML = html.join("")
    // })

    // ctre.$(".activationKeys").addEventListener("click", function (e) {
    //   chrome.runtime.sendMessage({ action: "goto_hotkey_settings" })
    //   e.preventDefault()
    // })

    ctre.$(".ct_close").addEventListener("click", function (e) {
      ctre.deactivate()
      e.preventDefault()
    })

    // ctre.$(".ct_minimize").addEventListener("click", function (e) {
    //   ctre.$(".ct_root").classList.toggle("minimized")
    //   e.preventDefault()
    // })

    ctre.$("#ctre_opt_remember").addEventListener("click", function (e) {
      ctre.settings.remember = this.textContent == "no"
      ctre.saveSettings()
      ctre.updateSettings()
      e.preventDefault()
    })

    for (let elm of ctre.$$(".ct_more a")) {
      elm.addEventListener("click", function (e) {
        ctre.deactivate()
      })
    }

    ctre.updateElementList()
    ctre.updateSettings()

    ctre.targetingMode = true
    document.addEventListener("mouseover", ctre.mouseover, true)
    document.addEventListener("mousemove", ctre.mousemove)
    document.addEventListener("mousedown", ctre.hideTarget, true)
    document.addEventListener("mouseup", ctre.preventEvent, true)
    document.addEventListener("click", ctre.preventEvent, true)

    ctre.addOverlays()

    chrome.runtime.sendMessage({ action: "status", active: true })

    setTimeout(function () {
      let logoElm = ctre.$(".logo")
      logoElm && logoElm.classList.add("anim")
    }, 10)
  },

  deactivate: function () {
    ctre.targetingMode = false

    if (ctre.markedElement) {
      ctre.removeHighlightStyle(ctre.markedElement)
    }
    ctre.markedElement = false

    ctre.helpWindow.parentNode.removeChild(ctre.helpWindow)

    document.removeEventListener("mouseover", ctre.mouseover, true)
    document.removeEventListener("mousemove", ctre.mousemove)
    document.removeEventListener("mousedown", ctre.hideTarget, true)
    document.removeEventListener("mouseup", ctre.preventEvent, true)
    document.removeEventListener("click", ctre.preventEvent, true)

    ctre.removeOverlays()

    chrome.runtime.sendMessage({ action: "status", active: false })
  },

  toggle: function () {
    if (ctre.targetingMode) ctre.deactivate()
    else ctre.activate()
  },

  addOverlays: function () {
    // add overlay over each iframe / embed
    // this is needed for capturing mouseMove over the whole document
    for (let e of document.querySelectorAll("iframe, embed")) {
      let rect = e.getBoundingClientRect()

      let new_node = document.createElement("div")
      new_node.className = "ctre_overlay"
      new_node.style.position = "absolute"
      new_node.style.left = rect.left + window.scrollX + "px"
      new_node.style.top = rect.top + window.scrollY + "px"
      new_node.style.width = rect.width + "px"
      new_node.style.height = rect.height + "px"
      new_node.style.background = "rgba(255,128,128,0.2)"
      new_node.style.zIndex = ctre.maxZIndex - 2
      new_node.relatedElement = e

      document.body.appendChild(new_node)
    }
  },

  removeOverlays: function () {
    let elms = document.querySelectorAll(".ctre_overlay")
    for (i = 0; i < elms.length; i++) {
      let e = elms[i]
      e.parentNode.removeChild(e)
    }
  },

  refreshOverlays: function () {
    ctre.removeOverlays()
    ctre.addOverlays()
  },

  handleExtensionMessage: function (msg, sender, respond) {
    if (msg.action == "toggle") {
      ctre.toggle()
      respond(2.5)
    } else if (msg.action == "getStatus") {
      respond(ctre.targetingMode)
    }
  },

  init: function () {
    document.addEventListener("keydown", ctre.keyDown)
    document.addEventListener("keyup", ctre.keyUp)

    chrome.runtime.onMessage.addListener(ctre.handleExtensionMessage)

    ctre.loadSavedElements()
  },

  destroy: function () {
    if (ctre.targetingMode) ctre.deactivate()
    document.removeEventListener("keydown", ctre.keyDown)
    document.removeEventListener("keyup", ctre.keyUp)

    chrome.runtime.onMessage.removeListener(ctre.handleExtensionMessage)

    let styleElm = document.querySelector("#ctre_styles")
    if (styleElm) styleElm.parentNode.removeChild(styleElm)
  },
}

ctre.init()

function closest(el, selector) {
  var retval = null
  while (el) {
    if (el.matches(selector)) {
      retval = el
      break
    }
    el = el.parentElement
  }
  return retval
}

function escapeHTML(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// let offsetX, offsetY

// function dragStart(e) {
//   // Here we use shadowRoot to get access to the shadow DOM
//   const shadowRoot = e.target.shadowRoot

//   // Update this line to refer to ctre_wnd instead of floatingPanel
//   offsetX =
//     e.clientX -
//     shadowRoot.querySelector("#ctre_wnd").getBoundingClientRect().left
//   offsetY =
//     e.clientY -
//     shadowRoot.querySelector("#ctre_wnd").getBoundingClientRect().top

//   document.addEventListener("mousemove", dragMove)
//   document.addEventListener("mouseup", dragEnd)
// }

// function dragMove(e) {
//   const x = e.clientX - offsetX
//   const y = e.clientY - offsetY

//   // Update this line to refer to ctre_wnd instead of floatingPanel
//   const ctreWnd = document.querySelector("#ctre_wnd")
//   ctreWnd.style.left = x + "px"
//   ctreWnd.style.top = y + "px"
// }

// function dragEnd() {
//   document.removeEventListener("mousemove", dragMove)
//   document.removeEventListener("mouseup", dragEnd)
// }

// @medv/finder@3.1.0 - https://github.com/antonmedv/finder
const cssFinder = (() => {
  let e, t
  function n(n, o) {
    if (n.nodeType !== Node.ELEMENT_NODE)
      throw Error("Can't generate CSS selector for non-element node type.")
    if ("html" === n.tagName.toLowerCase()) return "html"
    let u = {
      root: document.body,
      idName: (e) => !0,
      className: (e) => !0,
      tagName: (e) => !0,
      attr: (e, t) => !1,
      seedMinLength: 1,
      optimizedMinLength: 2,
      threshold: 1e3,
      maxNumberOfTries: 1e4,
    }
    t = l((e = { ...u, ...o }).root, u)
    let a = r(n, "all", () =>
      r(n, "two", () => r(n, "one", () => r(n, "none")))
    )
    if (a) {
      let f = _(w(a, n))
      return f.length > 0 && (a = f[0]), i(a)
    }
    throw Error("Selector was not found.")
  }
  function l(e, t) {
    return e.nodeType === Node.DOCUMENT_NODE
      ? e
      : e === t.root
      ? e.ownerDocument
      : e
  }
  function r(t, n, l) {
    let r = null,
      i = [],
      u = t,
      a = 0
    for (; u; ) {
      let y = g(f(u)) || g(...c(u)) || g(...s(u)) || g(m(u)) || [h()],
        N = d(u)
      if ("all" == n) N && (y = y.concat(y.filter(p).map((e) => $(e, N))))
      else if ("two" == n)
        (y = y.slice(0, 1)),
          N && (y = y.concat(y.filter(p).map((e) => $(e, N))))
      else if ("one" == n) {
        let [_] = (y = y.slice(0, 1))
        N && p(_) && (y = [$(_, N)])
      } else "none" == n && ((y = [h()]), N && (y = [$(y[0], N)]))
      for (let w of y) w.level = a
      if ((i.push(y), i.length >= e.seedMinLength && (r = o(i, l)))) break
      ;(u = u.parentElement), a++
    }
    return (r || (r = o(i, l)), !r && l) ? l() : r
  }
  function o(t, n) {
    let l = _(N(t))
    if (l.length > e.threshold) return n ? n() : null
    for (let r of l) if (a(r)) return r
    return null
  }
  function i(e) {
    let t = e[0],
      n = t.name
    for (let l = 1; l < e.length; l++) {
      let r = e[l].level || 0
      ;(n = t.level === r - 1 ? `${e[l].name} > ${n}` : `${e[l].name} ${n}`),
        (t = e[l])
    }
    return n
  }
  function u(e) {
    return e.map((e) => e.penalty).reduce((e, t) => e + t, 0)
  }
  function a(e) {
    let n = i(e)
    switch (t.querySelectorAll(n).length) {
      case 0:
        throw Error(`Can't select any node with this selector: ${n}`)
      case 1:
        return !0
      default:
        return !1
    }
  }
  function f(t) {
    let n = t.getAttribute("id")
    return n && e.idName(n) ? { name: "#" + CSS.escape(n), penalty: 0 } : null
  }
  function c(t) {
    let n = Array.from(t.attributes).filter((t) => e.attr(t.name, t.value))
    return n.map((e) => ({
      name: `[${CSS.escape(e.name)}="${CSS.escape(e.value)}"]`,
      penalty: 0.5,
    }))
  }
  function s(t) {
    let n = Array.from(t.classList).filter(e.className)
    return n.map((e) => ({ name: "." + CSS.escape(e), penalty: 1 }))
  }
  function m(t) {
    let n = t.tagName.toLowerCase()
    return e.tagName(n) ? { name: n, penalty: 2 } : null
  }
  function h() {
    return { name: "*", penalty: 3 }
  }
  function d(e) {
    let t = e.parentNode
    if (!t) return null
    let n = t.firstChild
    if (!n) return null
    let l = 0
    for (; n && (n.nodeType === Node.ELEMENT_NODE && l++, n !== e); )
      n = n.nextSibling
    return l
  }
  function $(e, t) {
    return { name: e.name + `:nth-child(${t})`, penalty: e.penalty + 1 }
  }
  function p(e) {
    return "html" !== e.name && !e.name.startsWith("#")
  }
  function g(...e) {
    let t = e.filter(y)
    return t.length > 0 ? t : null
  }
  function y(e) {
    return null != e
  }
  function* N(e, t = []) {
    if (e.length > 0)
      for (let n of e[0]) yield* N(e.slice(1, e.length), t.concat(n))
    else yield t
  }
  function _(e) {
    return [...e].sort((e, t) => u(e) - u(t))
  }
  function* w(t, n, l = { counter: 0, visited: new Map() }) {
    if (t.length > 2 && t.length > e.optimizedMinLength)
      for (let r = 1; r < t.length - 1; r++) {
        if (l.counter > e.maxNumberOfTries) return
        l.counter += 1
        let o = [...t]
        o.splice(r, 1)
        let u = i(o)
        if (l.visited.has(u)) return
        a(o) && E(o, n) && (yield o, l.visited.set(u, !0), yield* w(o, n, l))
      }
  }
  function E(e, n) {
    return t.querySelector(i(e)) === n
  }
  return n
})()
