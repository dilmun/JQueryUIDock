/**
 * Docking facility based on JQueryUI.
 * 
 * @version 0.01 
 * @author logarhymes
 */

'use strict';

/*** Widget definition & API ***/
$.widget('ui.dock', {
  options : {
    'maxDepth' : 3,           // Maximum number of divisions
    'paneMinSize' : '10%',
    'paneMaxSize' : '90%',
    'handle' : 'icon',
    'height' : 'root'         // Height of the root container
  },
  
  _create : function() {
    this.master = new MasterContainer(this.element, this.options);
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
    var view = new View(id, $elem, id);
    this.master.addView(view);
    this.master.split(Regions.WEST);
    
    /*
    this.master.prime.split(Regions.SOUTH);
    this.master.prime.second.split(Regions.EAST);
    this.master.prime.second.prime.split(Regions.EAST); */
    //this.master.transfer(view.id, this.master.prime.leaf.id, this.master.second.leaf.id);
  }
});

/*** Internal structure & behaviour ***/
var Regions = {
  CENTER : 0,
  NORTH : 1,
  EAST : 2,
  SOUTH : 3,
  WEST : 4
};

function MasterContainer(root, options) {
  var self = this;
  
  this.options = options;
  this.$root = $(root);
  this.id = this.$root.attr('id');
  this.$root.addClass('ui-dock-master');
  
  // Model variables
  var views = this.views = {};
  var docks = this.docks = {};
  this.root = null;
  
  // State variables
  var count = 0;
  
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
  
  this.registerDock = function(dock) {
    dock.id = this.id + count++;
    this.docks[dock.id] = dock;
  };
  
  this.transfer = function(viewID, originID, destinationID) {
    //TODO error handling
    var view = views[viewID];
    var origin = docks[originID];
    var destination = docks[destinationID];
    
    destination.transferView(origin.removeView(viewID));
    
    origin.resetTabs();
    destination.resetTabs();
    
    view.tab.updateDock(destination);
  };
  
  SplitContainer.call(this, this, null, new Dock(this, this));
  this.$root.append(this.$elem);
  
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
        'class': 'ui-dock-tabitem',
        'data-dock-id': this.dock.id,
        'data-view-id' : this.view.id
    }).append(this.$a)
      .append(close_icon);
      
  var handleOption = dock.master.options['handle'];
  // TODO maybe put a switch block here
  if (handleOption != null)
    if (handleOption == 'icon') {
      var handle = $('<span>')
            .addClass('ui-icon ui-icon-grip-diagonal-se ui-dock-tabitem-handle')
            .text('Click & drag');
      this.$li.prepend(handle);
    }
      
  this.updateDock = function(dock) {
    this.dock = dock;
    this.$li.attr('data-dock-id', dock.id);
  };
}

function Dock(master, parent) {
  this.master = master;
  this.parent = parent;
  
  master.registerDock(this);
  
  var self = this;
  var views =
    this.views = {};
  var $elem = 
    this.$elem = 
    $('<div>', {
      class : 'ui-dock-element'
    });
  var tracker = 
    this.tracker =
    new DropTracker(this);
    
  var sortable_cfg = {
    appendTo: master.$root,
    helper: 'clone', // This is required for the appendTo logic
    connectWith: '#' + self.master.id + ' .ui-dock-tablist',
    handle: master.options['handle'] ? '.ui-dock-tabitem-handle' : false,
    receive: function(event, ui) {
      var $li = ui.item;
      var viewID = $li.attr('data-view-id');
      var originID = $li.attr('data-dock-id');
      var destinationID = self.id;
      
      self.master.transfer(viewID, originID, destinationID);
    },
    activate: function(event, ui) {
      self.parent.$elem.addClass('ui-dock-container-frozen');
      self.tracker.startTracking();
    },
    deactivate: function(event, ui) {
      self.parent.$elem.removeClass('ui-dock-container-frozen');
      var originID = ui.item.attr('data-dock-id');
      var viewID = ui.item.attr('data-view-id');
      self.tracker.endTracking(viewID, originID);
    }
  };
    
  this.transferView = function(view) {
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
  
  this.closeView = function(viewID) {
    var view = this.removeView(viewID);
    view.tab.$li.remove();
    
    if (Object.keys(this.views).length == 0)
      this.parent.close();
    else
      refreshTabs();
      
    return view;
  };
  
  this.removeView = function(viewID) {
    if (!(viewID in this.views))
      $.error('Invalid view identifier ' + viewID);
    
    var view = views[viewID];
    view.$elem.remove();
    delete views[viewID];
    
    return view;
  };
  
  this.setParent = function(parent) {
    this.parent = parent;
    this.tracker.setContainer(parent);
  };
  
  this.rebuild = function() {
    $elem.tabs();
    self.tablist.sortable(sortable_cfg);
  };
  
  this.resetTabs = function() {
    $elem.tabs('destroy');
    $elem.tabs();
  };
  
  build();
  
  function build() {
    $elem.empty();
    
    self.tablist = generateTablist();
    $elem.append(self.tablist);
    
    $elem.tabs();
    self.tablist.sortable(sortable_cfg);
    
    self.tablist.on('click.ui-dock', 'span.ui-icon-close', function(event) {
      self.closeView($(event.target).data('view_id'));
    });
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
  this.level = parent ? parent.level + 1 : 0;
  this.$elem = $elem ? $elem : $('<div>');
  this.$elem.addClass('ui-dock-container ui-dock-container-leaf');
  this.$elem.append(dock.$elem);
  dock.setParent(this);
  
  // Leaf profile
  this.leaf = dock;
  // Split "profile"
  this.prime = null;
  this.second = null;
  this.splitRegion = null;
  
  this.layout = null;
  
  this.passView = function(view) {
    if (this.isSplit())
      this.prime.passView(view);
    else
      this.leaf.addView(view);
  };
  
  this.split = function(region) {
    if (this.level >= master.options['maxDepth'])
      return $.error("Can't split : Maximum number of divisions reached (" + 
        master.options['maxDepth'] + ")");
    
    this.leaf.$elem.detach();
    
    var prime = new SplitContainer(this.master, this, this.leaf);
    var newDock = new Dock(this.master, null);
    var second = new SplitContainer(this.master, this, newDock);
    
    this.$elem.append(prime.$elem);
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
    prime.$elem.addClass('ui-layout-center'); 
    
    this.splitRegion = region;
    prime.leaf.rebuild();
    
    applyLayout();
    this.leaf = null;
    this.prime = prime;
    this.second = second;
    
    this.$elem.removeClass('ui-dock-container-leaf');
    
    master.layout.resizeAll();
    
    return second;
  };
  
  this.isSplit = function() {
    return !this.leaf;
  };
  
  this.getDim = function() {
    return {
      width: this.$elem.width(),
      height: this.$elem.height()
    };
  };
  
  this.close = function() {
    this.parent.merge(this);
  };
  
  this.merge = function(closed) {
    var salvaged = 
      closed == this.prime ? this.second : this.prime;
    
    this.leaf = salvaged.leaf;
    this.prime = salvaged.prime;
    this.second = salvaged.second;
    
    var salvagedContent = salvaged.$elem.contents().detach();
    this.$elem.empty();
    this.$elem.append(salvagedContent);
    
    if (this.isSplit()) {
      this.prime.parent = this;
      this.second.parent = this;

      this.resetLayout();
    } else {
      this.leaf.parent = this;
      
      this.layout.destroy();
      this.$elem.addClass('ui-dock-container-leaf');
    }
  };
  
  this.resetLayout = function() {
    if (this.isSplit()) {
      /* destroy() propagates to nested layouts,
         so this should only fire once */
      if (this.layout && !this.layout.destroyed)
        this.layout.destroy();
      applyLayout();
    
      this.prime.resetLayout();
      this.second.resetLayout();
    }
  };
  
  function applyLayout() {
    self.layout = self.$elem.layout({
      applyDefaultStyles : false,
      north__size : '50%',
      south__size : '50%',
      east__size : '50%',
      west__size : '50%',
      
      north__minSize : '10%',
      south__minSize : '10%',
      east__minSize : '10%',
      west__minSize : '10%',
      
      north__maxSize : '90%',
      south__maxSize : '90%',
      east__maxSize : '90%',
      west__maxSize : '90%'
    });
  }
}

function DropTracker(dock) {
  var self = this;
  var master = dock.master;
  var container = dock.parent;
  var $elem = container ? container.$elem : null;
  var $hl = $('<div>').addClass('ui-dock-highlight').css('visibility', 'hidden');
  var currentRegion = false;
  var map = null;
  
  this.updateMap = updateMap;
  this.setContainer = function(cont) {
    container = cont;
    $elem = container.$elem;
  };
  this.startTracking = startTracking;
  this.endTracking = endTracking;
  this.check = check;
  this.updateMap = updateMap;
  this.clearHighlight = clearHighlight;

  function startTracking() {
    updateMap();
    $elem.append($hl);
    dock.master.$root.on('mousemove.ui-dock', check);
  }

  function endTracking(viewID, originID) {
    dock.master.$root.off('mousemove.ui-dock');
    $hl.remove();
    
    if (currentRegion !== false) {
      var newContainer = container.split(currentRegion);
      var view = master.docks[originID].closeView(viewID);
      newContainer.passView(view);
    }
    
    clearHighlight();
  }
  
  function check(event, ui) {
    highlightRegion(computeRegion(event.pageX, event.pageY));
  }
  
  function computeRegion(x, y) {
    if (x < map.pos.x 
        || x > map.pos.x + map.dim.w
        || y < map.pos.y
        || y > map.pos.y + map.dim.h)
        return false;
        
    //TODO default priority to horizontal regions, this should be configurable
    if (y < map.bounds.top)
      return Regions.NORTH;
    if (y > map.bounds.bottom)
      return Regions.SOUTH;
    if (x < map.bounds.left)
      return Regions.WEST;
    if (x > map.bounds.right)
      return Regions.EAST;
    
    return false;
  }
  
  function highlightRegion(region) {
    if (region != currentRegion) {
      if (region === false)
        clearHighlight();
      else {
        var info = map.regions[region];
        $hl.css( {
          'left' : info.x + 'px',
          'top' : info.y + 'px',
          'width' : info.w + 'px',
          'height' : info.h + 'px'
        });
        $hl.css('visibility', 'visible');
      }
      
      currentRegion = region;
    }
  }
  
  function clearHighlight() {
    currentRegion = false;
    $hl.css('visibility', 'hidden');
  }

  function updateMap() {
    map = {};
    var offset = $elem.offset();
    
    var pos = map.pos = {
      x : offset.left,
      y : offset.top
    };
    var dim = map.dim = {
      w : $elem.width(),
      h : $elem.height()
    };
    var span = map.span = {
      x : dim.w * 10 / 100,
      y : dim.h * 10 / 100
    };
    var bounds = map.bounds = {
      left : pos.x + span.x,
      right : pos.x + dim.w - span.x,
      top : pos.y + span.y,
      bottom : pos.y + dim.h - span.y
    };

    map.regions = {};
    
    map.regions[Regions.NORTH] = {
      x : 0,
      y : 0,
      w : dim.w,
      h : span.y
    };
    map.regions[Regions.SOUTH] = {
      x : 0,
      y : dim.h - span.y,
      w : dim.w,
      h : span.y
    };
    map.regions[Regions.WEST] =  {
      x : 0,
      y : 0,
      w : span.x,
      h : dim.h
    };
    map.regions[Regions.EAST] =  {
      x : dim.w - span.x,
      y : 0,
      w : span.x,
      h : dim.h
    };
  }
}

