/**
 * 
 * 
 * © Amine TOUZANI
 */
'use strict'; 

/* Library */
$.widget('mosaic.dock', { 
    /**
     * 
     */
    // Instance variables
    id: null,
    views: [],
    
    // Shared objets
    leaves: {},
    viewTracker: { current: null, focusEnabled: false },
  
    options: {
      // Following are in percent
      dropSpanX: 5,
      dropSpanY: 20,

      tabsOptions: {},
      sortableOptions: {},

      depthLimit: 2
    },
    
    _create: function() {
    	var that = this,
          options = this.options;
    	
      var childContainer = this.element.children('div');
      if (childContainer.length != 1)
        throw 'Dock element needs exactly one ui-tabs container inside';
      
      this.leaf = childContainer;
      this.views = {};
      this.tabs = {};
      
      this.element.addClass('ui-dock');
      
      this.id = this.element.prop('id');
      
      this.parent = null;
      this.level = 0;
      this.leaves[this.id] = this;
      
      // This is a div element
      this.leaf = childContainer;
      // These are widgets
      this.firstChild = null;
      this.secondChild = null;
      
      // Build tabs and sortable functionality
      this._refreshTabs();
      
      // Compute dropping areas
      this._computeAreas();
    },
    
    _enableFocus: function() {
      this.viewTracker.focusEnabled = true;
    },
    
    _disableFocus: function() {
      this.viewTracker.focusEnabled = false;
    },

    _createChild: function() {

    },

    _defineNode: function(parent) {
      this.parent = parent;
      this.level = parent.level + 1;
      this.viewTracker = parent.viewTracker;
      this.options.depthLimit = parent.options.depthLimit - 1;
    },
    
    _arm: function() {
      //TODO iterate on leaves
      this._startTracking();
      this._watchOut();
    },
    
    _disarm: function() {
      this._stopTracking();
      this.element.off('mouseenter');
      this.element.off('mouseout');
    },
    
    _watchEnter: function() {
      var that = this;
      
      this.element.mouseenter(function(enterEvent) {
        that.element.off('mouseenter');
        that._startTracking();
        that._watchOut();
      });
    },
    
    _watchOut: function() {
      var that = this;
      
      this.element.mouseout(function(enterEvent) {
        that.element.off('mouseout');
        that._stopTracking();
        that._watchEnter();
      });
    },
    
    _startTracking: function() {
      var that = this;
      
      this.element.mousemove(function(moveEvent) {
        if (that.viewTracker.focusEnabled)
          that._checkFocus(moveEvent.pageX, moveEvent.pageY);
      });
    },
    
    _stopTracking: function() {      
      this.element.off('mousemove');
    },
    
    _refreshTabs: function() { 
      var that = this;
      
      this.tabsWidget = this.leaf.data('ui-tabs');
      
      if (!this.tabsWidget)
      {
        this.leaf.tabs(this.options.tabsOptions);
        this.tabsWidget = this.leaf.data('ui-tabs');
      }
      else
        this.leaf.tabs('refresh');
      
      var tablist = this.tabsWidget.tablist;
      this.sortWidget = tablist.data('ui-sortable');
      
      if (!this.sortWidget)
      {
        tablist.sortable({
          connectWith: '.ui-dock .ui-sortable',
          
          over: function(event, ui) {
            that._disableFocus();
            that._clearFocus();
          },
          out: function(event, ui) {
            that._enableFocus();
          },
          start: function(event, ui) {
            var viewId = ui.helper.data('dock-view');
            that.viewTracker.current = viewId;
            
            that._arm();
          },
          stop: function(event, ui) {
            that._disarm();
            
            var targetArea = that.focused;
            
            that._clearFocus();
            
            if (targetArea >= 0 && targetArea <= 4)
              that._slice(that, targetArea);
            
            that._enableFocus();
          },
          receive: function(event, ui) {
            var viewId = ui.helper.data('dock-view');
            ui.helper.data('transferred', that);
            that._decorateTab(ui.item, viewId);
          }
        });
        tablist.on("click", "li span.ui-icon-close", function() {
          that.removeTab($(this).siblings('a').attr('href').substring(1));
        });
      }
      else        
        tablist.sortable('refresh');

      this.tabsWidget.tabs.each(function (index, element) {
        var li = $(element);
        
        // Add initial views
        var viewId = li.children('a').attr('href').substring(1);
        var view = that.leaf.find('#' + viewId);
        
        if (view.length != 1)
        {
          li.remove();
          return;
        }
        
        li.data('dock-view', viewId);
          
        that.tabs[viewId] = li;
        that.views[viewId] = view;
        
        that._decorateTab(li, viewId);
      });
    },
    
    _createCloseIcon: function() {
      return $('<span>Remove Tab</span>').addClass('ui-icon ui-icon-close');
    },
    
    _decorateTab: function(li, viewId) {    
      // Add closing controls
      var icon = li.find('span.ui-icon-close');
      if (icon.length < 1)
      {
        icon = this._createCloseIcon();
        li.append(icon);
      }
      
      li.data('origin', this);
    },
    
    _slice: function(origin, area) {      
      if (this.level > this.options.depthLimit)
      {
        console.log('Depth limit reached');
        return;
      }
      
      var viewId = origin.viewTracker.current;
      var view = origin.views[viewId];
      origin.removeTab(viewId);
      
      var thisElement = this.element.clone();
      var newElement = $('<div/>').append($('<div/>').append($('<ul/>')));
      
      this.element.empty();
      
      this.element.append(thisElement);
      
      var w = this.dim.w, h = this.dim.h;
      var thisArea, newArea;
      switch (area)
      {
      case 1:
        this.element.prepend(newElement);
        newArea = 'n';
        thisArea = 'c';
        h /= 2;
        break;
      case 2:
        this.element.append(newElement);
        newArea = 's';
        thisArea = 'c';
        h/= 2;
        break;
      case 3:
        this.element.prepend(newElement);
//        newElement.addClass('leftDock');
//        thisElement.addClass('rightDock');
        newArea = 'w';
        thisArea = 'c';
        w /= 2;
        break;
      default: 
        this.element.append(newElement);
//        thisElement.addClass('leftDock');
//        newElement.addClass('rightDock');
        newArea = 'e';
        thisArea = 'c';
        w /= 2;
        break;
      }

      
      var newDock = newElement.dock().data('mosaicDock');
      var thisDock = thisElement.removeAttr('id').dock().data('mosaicDock');

      newDock._defineNode(this);
      thisDock._defineNode(this);
      
      newElement.prop('id', this.element.prop('id') + '-' + newArea);
      thisElement.prop('id',  this.element.prop('id') + '-' + thisArea);
      
      thisDock.parent = newDock.parent = this;
      thisDock.level = newDock.level = (this.level + 1);
      
      this.firstChild = thisDock;
      this.secondChild = newDock;
         
      newDock.addTab(view);
      
      var elementId = this.element.prop('id');
      this.element.layout({
        defaults: {
          resizable: true
        },
        center: {
          paneSelector: '#' + elementId + '-c'
        },
        south: {
          paneSelector: '#' + elementId + '-s',
          size: h
        },
        north: {
          paneSelector: '#' + elementId + '-n',
          size: h
        },
        east: {
          paneSelector: '#' + elementId + '-e',
          size: w
        },
        west: {
          paneSelector: '#' + elementId + '-w',
          size: w
        }
      });
      
      newDock._computeAreas();
      thisDock._computeAreas();
    },
    
    addTab: function (view) {
      if (this._isSliced())
      {
        this.firstChild.addTab(view);
        return;
      }
      
      var viewId = view.attr('id');
      if (!viewId || this.views[viewId] != null)
        throw 'Element to add must have a unique id';
  
      this.views[viewId] = view;
      
      if (this._isSliced()) {
        this.firstChild.addTab(view);
        return;
      }
  
      var li = $('<li/>')
        .append($('<a>' + viewId + '</a>').attr('href', '#' + viewId))
        .append($('<span>Remove Tab</span>').addClass('ui-icon ui-icon-close'));
      this.tabs[viewId] = li;
      this.leaf.append(view);
      this.tabsWidget.tablist.append(li);
      
      this._refreshTabs();
    },
    
    removeTab: function(id) {
      this.views[id].remove();
      this.tabs[id].remove();
      this._refreshTabs();
    },
    
    _isSliced: function() {
    	return this.firstChild != null && this.secondChild != null;
    },
    
    _checkFocus: function (mousex, mousey) {
      if (!this.viewTracker.focusEnabled || 
            mousex <= this.pos.x || mousex >= this.pos.x + this.dim.w ||
            mousey <= this.pos.y || mousey >= this.pos.y + this.dim.h)
         return;

    	// Checks vertical areas first
      for (var i = 1; i < this.areas.length; i++)
      {
        var area = this.areas[i];
        if (mousex > area.x && mousex < area.x + area.w
            && mousey > area.y && mousey < area.y + area.h)
        {
          if (this.focused != i)
            this._focusArea(i);
          return;
        }
      }
		  
			this._focusArea(0);
    },
    
    _focusArea: function(areaIndex) {
    	this._clearFocus();
    	var area = this.areas[areaIndex];
    	
    	this.focused = areaIndex;
    	
    	this.shadow = $('<div/>').hide();
    	this.element.append(this.shadow);
    	this.shadow
    	  .addClass('dockShadow')
    		.width(area.w - 6)
	    	.height(area.h - 6)
//	    	.css('position', 'absolute')
	    	.offset({
	    		left:area.x,
	    		top:area.y
	    	})
	    	.show();
    },
    
    _clearFocus: function() {
      if (this.shadow)
        this.shadow.remove();
      this.shadow = null;
      this.focused = -1;
    },
    
    _computeAreas: function() {
    	// Compute dropping areas
        var offset = this.element.offset();
        this.pos = {
        	x: offset.left,
        	y: offset.top 
        };
        this.dim = {
        	w: this.element.width(),
        	h: this.element.height()
        };
        var pos = this.pos, dim = this.dim;
        
        //TODO check dropSpan option values
        this.span = {
        	x: dim.w * this.options.dropSpanX / 100,
        	y: dim.h * this.options.dropSpanY / 100
        };
        var span = this.span;

        this.bounds = {
        		left: pos.x + span.x,
        		right: pos.x + dim.w - span.x,
        		top: pos.y + span.y,
        		bottom: pos.y + dim.h - span.y
        };
        var bounds = this.bounds;
        
        this.areas = [
          { // CENTER
            x: pos.x,
            y: pos.y, 
            w: dim.w, 
            h: dim.h
          },         
          { // NORTH
            x: pos.x,
            y: pos.y, 
            w: dim.w, 
            h: span.y
          },
          { // SOUTH
            x: pos.x, 
            y: bounds.bottom, 
            w: dim.w, 
            h: span.y
          },
          { // LEFT
            x: pos.x, 
            y: pos.y, 
            w: span.x, 
            h: dim.h
          },
          { // RIGHT
            x: bounds.right, 
            y: pos.y, 
            w: span.x, 
            h: dim.h
          }
        ];
    }
});


/* Test code */
$(document).ready(function() {
  var i = 0;
  $('button').button().click(function() { $('#root').dock('addTab', $('<div id="cac' + i + '">Trucmuche</div>')); i++; });
  var dock = $('#root').dock();
});