/**
 * Docking facility based on JQueryUI.
 * 
 * @version 0.01 
 * @author logarhymes
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
  
  //FIXME testing methods
  ,testSplit: function(id, $elem) {
    this.master.split(new View(id, $elem, id), Regions.WEST);
  },
  testFurtherSplit: function(id, $elem) {
    this.master.prime.split(new View(id, $elem, id), Regions.NORTH);
  },
});

/*** Internal structure & behaviour ***/
var Regions = {
  CENTER : 0,
  NORTH : 1,
  EAST : 2,
  SOUTH : 3,
  WEST : 4
};

function MasterContainer(element) {
  var self = this;
  this.$elem = $(element);
  
  SplitContainer.call(this, this, null, new Dock(this, this), this.$elem);
  
  this.views = {};
  this.docks = {};
  this.root = null;
  
  this.addView = function(view) {
    if (view.id in this.views)
      return $.error('There is already a view with identifier ' + view.id);

    this.views[view.id] = view;
    this.passView(view);
  };

  this.removeView = function(viewID) {
    if (!(viewID in this.views))
      $.error('Invalid view identifier ' + viewID);
      
    delete this.views[viewID];
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
  close_icon.text('Close view');
  close_icon.data('view_id', view.id);
    
  this.$li = $('<li>', {
        class: 'ui-dock-tabitem'
    }).append(this.$a)
      .append(close_icon);
  this.$li.data('tab', this);
}

function Dock(master, parent) {
  this.master = master;
  this.parent = parent;
  
  var self = this;
  var views =
    this.views = {};
  var $elem = 
    this.$elem = 
    $('<div>', {
      class : 'ui-dock-container'
    });
    
  var sortable_cfg = {
    connectWith: '.ui-dock-tablist',
    receive: function(event, ui) {
      var tab = ui.item.data('tab');
      var view = tab.view;
      var origin = tab.dock;
      
      origin.removeView(view.id);
      self.transferView(tab);
    }
  };
    
  this.transferView = function(tab) {
    var view = tab.view;
    views[view.id] = view;
    $elem.append(view.$elem);
    
    refreshTabs();
  };
    
  this.addView = function(view) {
    views[view.id] = view;
    
    var tab = generateTab(view);
    self.tablist.append(tab.$li);
    $elem.append(view.$elem);
    
    refreshTabs();
  };
  
  this.removeView = function(viewID) {
    if (!(viewID in this.views))
      $.error('Invalid view identifier ' + viewID);
    
    var view = views[viewID];
    var tab = view.tab;
    
    view.$elem.remove();
    tab.$li.remove();
    delete views[viewID];
    
    refreshTabs();
    
    return view;
  };
  
  this.setParent = function(parent) {
    this.parent = parent;
  };
  
  this.rebuild = function() {
    $elem.tabs();
    self.tablist.sortable(sortable_cfg);
  };
  
  build();
  
  function build() {
    $elem.empty();
    
    self.tablist = generateTablist();
    $elem.append(self.tablist);
    
    $elem.tabs();
    self.tablist.sortable(sortable_cfg);
    
    self.tablist.on('click', 'span.ui-icon-close', function(event) {
      self.removeView($(event.target).data('view_id'));
    });
  }
  
  function split(viewID) {
    var removedView = self.removeView(viewID);
    self.parent.split(removedView);
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
    self.tablist.sortable('refresh');
  }
}

function SplitContainer(master, parent, dock, $elem) {
  var self = this;
  
  this.master = master;
  this.parent = parent;
  this.$elem = $elem ? $elem : $('<div>');
  this.$elem.addClass('ui-dock-container');
  this.$elem.append(dock.$elem);
  dock.setParent(this);
  
  // Leaf profile
  this.leaf = dock;
  // Split "profile"
  this.prime = null;
  this.second = null;
  this.axis = null;
  
  this.passView = function(view) {
    if (this.isSplit())
      this.prime.passView(view);
    else
      this.leaf.addView(view);
  };
  
  this.split = function(view, region) {
    this.$elem.empty();
    
    var prime = new SplitContainer(this.master, this, this.leaf);
    var newDock = new Dock(this.master, null);
    var second = new SplitContainer(this.master, this, newDock);
    newDock.addView(view);
    
    this.$elem.append(prime.$elem);
    prime.$elem.addClass('ui-layout-center'); 
    switch (region) {
      case Regions.NORTH:
        this.$elem.prepend(second.$elem);
        second.$elem.addClass('ui-layout-north');
        break;
      case Regions.EAST:
        this.$elem.append(second.$elem);
        second.$elem.addClass('ui-layout-east');
        break;
      case Regions.SOUTH:
        this.$elem.append(second.$elem);
        second.$elem.addClass('ui-layout-south');
        break;
      case Regions.WEST:
        this.$elem.prepend(second.$elem);
        second.$elem.addClass('ui-layout-west');
        break;
    }
    
    this.$elem.layout({
      applyDefaultStyles : false
    });
    
    prime.leaf.rebuild();
    this.leaf = null;
    this.prime = prime;
    this.second = second;
  };
  
  this.isSplit = function() {
    return !this.leaf;
  };
}

