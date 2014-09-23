'use strict';

/* Library */
$.widget('mosaic.dock', { 
  
    options: {
      depthLimit: 2,
      // Following are in percent
      dropSpanX: 5,
      dropSpanY: 20,
      width: '100%',
      height: '600px'
    },
    
    _create: function() {
    	var that = this;
    	
      var childContainer = this.element.children('div');
      if (childContainer.length != 1)
        throw 'Dock element needs exactly one tab container inside';
      this.tabsWidget = childContainer.tabs().data('ui-tabs');
      this.tabsWidget.tablist.sortable({

        stop: function() {
          that.leaf.tabs('refresh');
          $(this).sortable('refresh');
        }
      });
      
      this.element.css('min-width', this.options.width).css('min-height', this.options.height);
      childContainer.children('div').css('min-width', this.options.width).css('min-height', this.options.height);
      
      this.parent = null;
      this.level = 0;
      
      // This is a div element
      this.leaf = childContainer;
      // These are widgets
      this.firstChild = null;
      this.secondChild = null;
      
      this.views = {};
      
      // Make tabs draggable
      this.tabs = {};
      
      this._refreshTabs();
      
      // Compute dropping areas
      this._computeAreas();
      
      this.element.droppable({
    	  accept: function(el) {
    	        /* This is a filter function, you can perform logic here 
              depending on the element being filtered: */
           return el.hasClass('drag-tab');
    	  },
    	  tolerance: 'pointer',
    	  over: function(overEvent, ui) {    		  
    	    that.currentDraggable = ui.draggable;
    		  $(this).mousemove(function(moveEvent) {
    			  that._checkFocus(moveEvent.pageX, moveEvent.pageY);
    		  });
    	  },
    	  out: function(event, ui) {
    		  that._clearFocus();
    		  $(this).off('mousemove');
    	  },
    	  deactivate: function(event, ui) {
    	    if (!ui.draggable.data('origin'))
    	      that._clearFocus();
    		  $(this).off('mousemove');
    	  },
    	  drop: function(event, ui) {
    	    var originWidget = ui.draggable.data('origin');
    		  ui.draggable.data('origin', false);
    	  }
      });
    },
    
    _refreshTabs: function() { 
      var that = this;
      this.tabsWidget.tabs.each(function (index, element) {
        var li = $(element);
        li.addClass('drag-tab');
//            .draggable(
//             { 
//              revert: function() {
//                return !this.data('origin');
//              },
//              revertDuration: 0,
//              helper: function() {
//                return $(this).clone();
//              },
////              helper: 'clone',
//              connectToSortable: 'ul[role="tablist"]',
//              stop: function() {
//                that.leaf.tabs('refresh');
//                that.tabsWidget.tablist.sortable('refresh');
//              }});
        li.data('origin', false);
      });
    },
    
    _slice: function(areaIndex) {
      
    },
    
    addTab: function (view) {
      var viewId = view.attr('id');
      if (!viewId || this.views[viewId] != null)
        throw 'Element to add must have a unique id';
  
      this.views[viewId] = view;
      view.css('min-width', this.options.width).css('min-height', this.options.height);
      
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
      
      var that = this;
      
      li.delegate( "span.ui-icon-close", "click", function() {
        var panelId = $( this ).siblings( "a" ).attr( "href" );
        that.removeTab(panelId.substring(1));
      });
  
      this._refreshTabs();
      this.leaf.tabs('refresh');
    },
    
    removeTab: function(id) {
      this.views[id].remove();
      this.tabs[id].remove();
      this.leaf.tabs( "refresh" );
    },
    
    _isSliced: function() {
    	return this.firstChild != null && this.secondChild != null;
    },
    
    _checkFocus: function (mousex, mousey) {
      var pos = this.pos, dim = this.dim, span = this.span, bounds = this.bounds;
        
    	// Checks vertical areas first
      for (var i = 0; i < this.areas.length; i++)
      {
        var area = this.areas[i];
        if (mousex > area.x && mousex < area.x + area.w
            && mousey > area.y && mousey < area.y + area.h)
        {
          this._focusArea(i);
          return;
        }
      }
		  
			this._clearFocus();
    },
    _focusArea: function(areaIndex) {
    	this._clearFocus();
    	var area = this.areas[areaIndex];
    	
    	var that = this;
    	this.currentDraggable.data('origin', this);;
    	
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
	    	.show()
	    	.mouseout(function(event) {
	    		that._checkFocus(event.offsetX, event.offsetY);
	    	});
    },
    _clearFocus: function() {
      if (this.shadow)
        this.shadow.remove();
      if (this.currentDraggable)
        this.currentDraggable.data('origin', false);
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
        		bottom: pos.y + dim.h - span.y,
        };
        var bounds = this.bounds;
        
        this.areas = [
          { // NORTH
            x: pos.x,
            y: pos.y, 
            w: dim.w, 
            h: span.y,
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