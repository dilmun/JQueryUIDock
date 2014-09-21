/**
 * @author Amine
 */

'use strict';

/*** Widget definition & API ***/
$.widget('ui.dock', {
  _create : function() {
    this.master = new MasterContainer(this.element);
  },

  // Adds a view to the highest, leftmost dock available
  add : function(id, $elem, title) {
    if (!title)
      title = id;
    var view = new View(id, $elem, title);
    this.master.addView(view);
  }
});

/*** Internal structure & behaviour ***/
function MasterContainer(element) {
  var self = this;
  this.$elem = $(element);
  this.views = {};
  this.docks = {};
  this.root = null;

  this.addView = function(view) {
    if (view.id in this.views)
      return $.error('There is already a view with identifier ' + view.id);

    this.views[view.id] = view;    
    
    if (!this.root) 
      buildRoot();
    this.root.addView(view);
  };
  
  this.removeView = function(viewID) {
    if (!(viewID in this.views))
      $.error('Invalid view identifier ' + viewID);
    
    this.root.removeView(viewID);
  };
  
  function buildRoot() {
    self.root = new Dock(self);
    self.$elem.append(self.root.$elem);
  }
}

function View(id, $elem, title) {
  this.id = id;
  this.$elem = $elem;
  this.title = title ? title : id;
}

function Tab(dock, view) {
  this.dock = dock;
  this.view = view;
  view.tab = this;
  
  this.$a = $('<a>', {
      href: '#' + view.id
    }).text(view.title);
    
  var close_icon = $('<span>', {
    class: 'ui-icon ui-icon-close',
    role: 'presentation'
  });
    
  this.$li = $('<li>', {
        class: 'ui-dock-tabitem'
    }).append(this.$a);
}

function Dock(master) {
  this.master = master;
  
  var self = this;
  var views = {};
  var $elem = 
    this.$elem = 
    $('<div>', {
      class : 'ui-dock-container'
    });
    
  this.addView = function(view) {
    views[view.id] = view;
    
    var tab = generateTab(view);
    self.tablist.append(tab.$li);
    $elem.append(view.$elem);
    
    refreshTabs();
  };
  
  build();
  
  function build() {
    $elem.empty();
    
    self.tablist = generateTablist();
    $elem.append(self.tablist);
    
    $elem.tabs();
  }
  
  function generateTab(view) {
    return new Tab(self, view);
  }
  
  function generateTablist() {
    return $('<ul>', {
      class: 'ui-dock-tablist'
    });
  }
  
  function refreshTabs() {
    $elem.tabs('refresh');
  }
}

function Container() {

}
