/*
	This work is licensed under a Creative Commons License.

	License: http://creativecommons.org/licenses/by/1.0/

	You are free:

	to copy, distribute, display, and perform the work
	to make derivative works
	to make commercial use of the work

	Under the following conditions:

	Attribution. You must give the original author credit

	Author:  Dean Edwards/2004
	Web:     http://dean.edwards.name/
*/

/* keeping code tidy! */

/* extendible css query function for most platforms */

/* 1.0.0 2004/04/09 */

// -----------------------------------------------------------------------
//  css query engine
// -----------------------------------------------------------------------

var cssQuery = function() {
	// constants
	var STANDARD_SELECT = /^[^>\+~\s]/;
	var STREAM = /[\s>\+~:@\*#\.]|[^\s>\+~:@\*#\.]+/g;
	var NAMESPACE = /\|/;
	var IMPLIED_SELECTOR = /([\s>\+~\,]|^)([\.:#@])/g;
	var ASTERISK ="$1*$2";
	var QUOTED = /([\'\"])[^\1]*\1/;
	var WHITESPACE = /^\s+|\s*([\+\,>\s;:])\s*|\s+$/g;
	var TRIM = "$1";
	var NODE_ELEMENT = 1;
	var NODE_TEXT = 3;

	// sniff for explorer (cos of one little bug)
	var isMSIE = /^ms/.test(document.documentElement.uniqueID);
	// need to check the "from" parameter, so this is not quite right -@DRE
	var isXML = Boolean(document.mimeType == "XML Document");

	// this is the query function
	function cssQuery(selector, from) {
		if (!selector) return [];
		from = (from) ? (from.constructor == Array) ? from : [from] : [document];
		// process comma separated selectors
		var selectors = parseSelector(selector).split(",");
		var match = [];
		for (var i in selectors) {
			// convert the selector to a stream
			selector = toStream(selectors[i]);
			// process the stream
			var j = 0;
			while (j < selector.length) {
				// process a token/filter pair
				from = select(from, selector[j++], selector[j++]);
			}
			match = match.concat(from);
		}
		// return the filtered selection
		return match;
	};

	function parseSelector(selector) {
		return selector
		// trim whitespace
		.replace(WHITESPACE, TRIM)
		// encode attribute selectors
		.replace(attributeSelector.ALL, attributeSelector.ID)
		// e.g. ".class1" --> "*.class1"
		.replace(IMPLIED_SELECTOR, ASTERISK);
	};

	// convert css selectors to a stream of tokens and filters
	//  it's not a real stream. it's just an array of strings.
	function toStream(selector) {
		if (STANDARD_SELECT.test(selector)) selector = " " + selector;
		return selector.match(STREAM) || [];
	};

	var pseudoClasses = { // non-dynamic
		// CSS1
		"link": function() {
			for (var i = 0; i < document.links; i++) {
				if (document.links[i] == this) return true;
			}
		},
		"visited": function() {
			// can't do this without jiggery-pokery
			return false;
		},
		// CSS2
		"first-child": function() {
			return !previousElement(this);
		},
		// CSS3
		"last-child": function() {
			return !nextElement(this);
		},
		"root": function() {
			return Boolean(this == document.body || this == document.documentElement);
		},
		"empty": function() {
			for (var i = 0; i < this.childNodes.length; i++) {
				if (isElement(this.childNodes[i]) || this.childNodes[i].nodeType == NODE_TEXT) return false;
			}
			return true;
		}
		// add your own...
	};

	attributeSelectors = [];

	// virtual
	function _attributeSelector() {
		// properties
	//- this.id = 0;
	//- this.attribute = "";
	//- this.test = new Function;
		this.toString = function() {
			return attributeSelector.PREFIX + this.id;
		};
		this.apply = function(element) {
			return this.test.apply(element);
		};
	};

	function attributeSelector(attribute, compare, value) {
		// properties
		this.id = attributeSelectors.push(this) - 1;
		this.attribute = attribute;
		// build the test expression
		switch (attribute.toLowerCase()) {
			case "id":
				attribute = "this.id";
				break;
			case "class":
				attribute = "this.className";
				break;
			default:
				attribute = "this.getAttribute('" + attribute + "')";
		}
		// continue building the test expression
		switch (compare) {
			case "=":
				if (!QUOTED.test(value)) value = quote(value);
				this.test = new Function("return " + attribute + "==" + value);
				break;
			case "~=":
				if (QUOTED.test(value)) value = unquote(value);
				this.test = new Function("return /\\b" + value + "\\b/.test(" + attribute + ")");
				break;
			default:
				this.test = new Function("return " + attribute);
		}
	};
	// inheritance
	attributeSelector.prototype = new _attributeSelector;

	// constants
	attributeSelector.PREFIX = "@";
	attributeSelector.ALL = /\[([^~=\]]+)(~?=?)([^\]]+)?\]/g;

	// class methods
	attributeSelector.ID = function(match, attribute, compare, value) {
		return new attributeSelector(attribute, compare, value);
	};

	// select a set of matching elements.
	// "from" is an array of elements.
	// "token" is a character representing the type of filter
	//  e.g. ">" means child selector
	// "filter" represents the tag name, id or class name that is being selected
	// the function returns an array of matching elements
	function select(from, token, filter) {
		//alert("token="+token+",filter="+filter);
		var namespace = "";
		if (NAMESPACE.test(filter)) {
			filter = filter.split("|");
			namespace = filter[0];
			filter = filter[1];
		}
		var filtered = [], i;
		switch (token) {
			case " ": // descendant
				for (i in from) {
					var subset = getElementsByTagNameNS(from[i], filter, namespace);
					for (var j = 0; j < subset.length; j++) {
						if (isElement(subset[j]) && (!namespace || compareNamespace(subset[j], namespace)))
							filtered.push(subset[j]);
					}
				}
				break;
			case ">": // child
				for (i in from) {
					var subset = from[i].childNodes;
					for (var j = 0; j < subset.length; j++)
						if (compareTagName(subset[j], filter, namespace)) filtered.push(subset[j]);
				}
				break;
			case "+": // adjacent (direct)
				for (i in from) {
					var adjacent = nextElement(from[i]);
					if (adjacent && compareTagName(adjacent, filter, namespace)) filtered.push(adjacent);
				}
				break;
			case "~": // adjacent (indirect)
				for (i in from) {
					var adjacent = from[i];
					while (adjacent = nextElement(adjacent)) {
						if (adjacent && compareTagName(adjacent, filter, namespace)) filtered.push(adjacent);
					}
				}
				break;
			case ".": // class
				filter = new RegExp("\\b" + filter + "\\b");
				for (i in from) if (filter.test(from[i].className)) filtered.push(from[i]);
				break;
			case "#": // id
				for (i in from) if (from[i].id == filter) filtered.push(from[i]);
				break;
			case "@": // attribute selectors
				filter = attributeSelectors[filter];
				for (i in from) if (filter.apply(from[i])) filtered.push(from[i]);
				break;
			case ":": // pseudo-class (not dynamic)
				filter = pseudoClasses[filter];
				for (i in from) if (filter.apply(from[i])) filtered.push(from[i]);
				break;
		}
		return filtered;
	};

	function getElementsByTagNameNS(from, tagName, namespace) {
		return (namespace && from.getElementsByTagNameNS) ?	from.getElementsByTagNameNS("*", tagName) :
		       (isMSIE && tagName == "*") ? from.all : from.getElementsByTagName(tagName);
	};

	function compareTagName(element, tagName, namespace) {
		if (namespace && !compareNamespace(element, namespace)) return false;
		return (tagName == "*") ? isElement(element) : (isXML) ? (element.tagName == tagName) : (element.tagName == tagName.toUpperCase());
	};

	function compareNamespace(element, namespace) {
		return (isMSIE) ? Boolean(element.scopeName == namespace) : Boolean(element.prefix == namespace);
	};

	// return the previous element to the supplied element
	//  previousSibling is not good enough as it might return a text or comment node
	function previousElement(element) {
		while ((element = element.previousSibling) && !isElement(element)) continue;
		return element;
	};

	// return the next element to the supplied element
	function nextElement(element) {
		while ((element = element.nextSibling) && !isElement(element)) continue;
		return element;
	};

	function isElement(node) {
		return Boolean(node.nodeType == NODE_ELEMENT && node.tagName != "!");
	};

	function quote(string) {return "'" + string + "'";};
	function unquote(string) {return string.slice(1, -1);};

	return cssQuery;
}();
