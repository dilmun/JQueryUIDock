/**
 * Docking facility based on JQueryUI & UI Layout.
 * 
 * @version 0.02 
 * @author logarhymes
 */

'use strict';

var Regions = {
  NORTH : 1,
  EAST : 2,
  SOUTH : 3,
  WEST : 4
};

/*** Widget definition & API ***/
$.widget('ui.dock', {
  /**
   * The widget declaration object only contains external
   * methods and jQueryUI paperwork, all logic is encapsulated
   * in the classes below.
   */
  version : '0.1.0',
  options : {
    'maxDepth' : 3,           // Maximum number of divisions
    'paneMinSize' : '10%',
    'paneMaxSize' : '90%',
    'handle' : 'icon',
    'height' : 'root',         // Height of the root container
    'highlightSpanX' : '10%',
    'highlightSpanY' : '15%',
    'verticalPriority' : false,
    
    // Default allowed regions
    NORTH : false,
    EAST : true,
    SOUTH : true,
    WEST : true
  },
  
  _create : function() {
    this.master = new MasterContainer(this.element, this.options);
  },

  // Adds a view to the highest, leftmost dock available
  add : function(id, $elem, title, closeable) {
    this.master.addView(id, $elem, title, closeable);
  }
});

/*** Internal structure & behaviour ***/
/**
 * Represents a tabbed view that can be
 * transferred from dock to dock.
 * 
 * @constructor
 */
function View(id, $elem, title, closeable) {
  if (!id)
    return $.error('Missing view identifier');
  this.id = id;
  
  if ($elem instanceof jQuery)
    this.$elem = $elem;
  else if ($elem)
    this.$elem = $($elem);
  else
    return $.error('No DOM element provided for view ' + id);
  
  this.$elem.attr('id', id);
  
  this.title = title ? title : id;
  this.closeable = closeable === undefined ? true : closeable;
  this.tab = false;
  
  this.getDock = function() { //TODO check usefulness
    if (this.tab)
      return this.tab.dock;
    return false;
  };
}

/**
 * A tab object links a view to its containing
 * dock ; it also holds a reference to the 
 * corresponding tab item (the draggable <li>  
 * element).
 * 
 * @constructor
 */
function Tab(dock, view) {
  this.dock = dock;
  this.view = view;
  view.tab = this;
  
  var $a = $('<a>', {
      'href' : '#' + view.id
    }).text(view.title);
    
  var close_icon = $('<span>', {
    'class' : 'ui-icon ui-icon-close',
    'role' : 'presentation'
  });
  close_icon
    .text('Close view')
    .data('view_id', view.id);
    
  var $li = $('<li>', {
        'class': 'ui-dock-tabitem',
        'data-dock-id': this.dock.id,
        'data-view-id' : this.view.id
    }).append($a)
      .append(close_icon);
      
  var handleOption = dock.master.options['handle'];
  if (handleOption == 'icon') {
    var handle = $('<span>');
    handle
      .addClass('ui-icon ui-icon-grip-diagonal-se ui-dock-tabitem-handle')
      .text('Click & drag');
    $li.prepend(handle);
  }
    
  this.getTabItem = function() {
    return $li;
  };
      
  this.updateDock = function(dock) {
    this.dock = dock;
    $li.attr('data-dock-id', dock.id);
  };
}

/** 
 * The master container keeps track of all docks
 * and views added to the widget, and implements
 * operations that require coordination between 
 * multiple nodes.
 * 
 * @constructor
 */
function MasterContainer(rootElement, options) {
  var self = this;
  
  this.options = options;
  this.$root = $(rootElement);
  this.id = this.$root.attr('id');
  
  // Model variables
  var views = this.views = {};
  var docks = this.docks = {};
  
  // State variables
  var count = 0; // Used for producing unique dock IDs
  var armed = false;
  var moved = false;
  
  this.addView = function(id, $elem, title, closeable) {
    if (id in this.views)
      return $.error('There is already a view with identifier ' + view.id);
      
    var view = new View(id, $elem, title, closeable);
    this.views[view.id] = view;
    return this.passView(view);
  };

  this.deleteView = function(viewID) {
    if (!(viewID in this.views))
      $.error('Invalid view identifier ' + viewID);
    
    var view = this.views[viewID];
    view.getDock().closeView(viewID);
    delete this.views[viewID];
  };
  
  this.registerDock = function(dock) {
    dock.id = this.id + count++;
    this.docks[dock.id] = dock;
  };
  
  this.unregisterDock = function(dock) {
    delete this.docks[dock.id];
  };
  
  this.doReceive = function(dock, event, ui) {
    var $li = ui.item;
    var viewID = $li.attr('data-view-id');
    var originID = $li.attr('data-dock-id');
    var destinationID = dock.id;

    this.shutTrackers(event, ui);
    if (originID != destinationID && !moved)
      this.transfer(viewID, originID, destinationID);
  };
  
  this.transfer = function(viewID, originID, destinationID) {
    var view = views[viewID];
    var origin = docks[originID];
    var destination = docks[destinationID];
    
    origin.resetTabs();
    destination.transferView(origin.extractView(viewID));
    destination.resetTabs();
    
    view.tab.updateDock(destination);
  };
  
  this.armTrackers = function(event, ui) {
    armed = true;
    moved = false;
    for (var id in docks) {
      var dock = docks[id];
      dock.parent.$elem.addClass('ui-dock-container-frozen');
      if (dock.tracker)
        dock.tracker.startTracking();
    }
  };
  
  this.shutTrackers = function(event, ui) {
    if (!armed)
      return;
      
    for (var id in docks) {
      var dock = docks[id];
      dock.parent.$elem.removeClass('ui-dock-container-frozen');
      
      if (!dock.tracker)
        continue;
      
      var originID = ui.item.attr('data-dock-id');
      var viewID = ui.item.attr('data-view-id');
      if (dock.tracker.endTracking(viewID, originID))
        moved = true;
    }
    armed = false;
  };
  
  SplitContainer.call(this, this, null, new Dock(this, this));
  this.$root.addClass('ui-dock-master');
  this.$root.append(this.$elem);
  if (options['height'] !== 'root')
    this.$elem.height(options['height']);
}

function Dock(master, parent) {
  this.master = master;
  this.parent = parent;
  
  var self = this;
  var views =
    this.views = {}; // Local views
  var $elem = 
    this.$elem = 
    $('<div>', {
      'class' : 'ui-dock-element',
      'id' : this.id
    });
  var tracker = null;
  
  // Active view ID
  var active = null;
    
  var sortable_cfg = {
    appendTo: master.$root,
    helper: 'clone', // This is required for the appendTo logic
    connectWith: 
      '#' + self.master.id + ' .ui-dock-tablist',
    handle: 
      master.options['handle'] !== false ? '.ui-dock-tabitem-handle' : false,
    distance: 20,
    tolerance: 'pointer',
      
    // Callbacks
    start: function(event, ui) {
      master.armTrackers(event, ui);
      var rule = window.getComputedStyle(
        document.querySelector('.ui-dock-master .ui-tabs .ui-tabs-nav li, .ui-dock-master > .ui-dock-tabitem'));
    },
    stop: function(event, ui) {
      master.shutTrackers(event, ui);
    },
    receive: function(event, ui) {
      master.doReceive(self, event, ui);
    }
  };
  
  var tabs_cfg = {
    activate: function(event, ui) {
      active = ui.newTab.attr('data-view-id');
    }
  };
  
  // Used when corresponding tabitem is already inserted
  this.transferView = function(view) {
    views[view.id] = view;
    $elem.append(view.$elem);
  };
  
  // Used when the tab needs to be created
  this.addView = function(view) {
    views[view.id] = view;
    
    var tab = new Tab(self, view);;
    self.tablist.append(tab.getTabItem());
    $elem.append(view.$elem);
    
    refreshTabs();
    
    return this;
  };
  
  this.closeView = function(viewID) {
    var view = this.extractView(viewID);  
    view.tab.getTabItem().remove();    
    
    return view;
  };
  
  this.extractView = function(viewID) {
    if (!(viewID in this.views))
      $.error('Invalid view identifier ' + viewID);
    
    var view = views[viewID];
    view.$elem.remove();
    delete views[viewID];
    
    if (Object.keys(this.views).length == 0)
      this.parent.close();
    else
      refreshTabs();

    return view;
  };
  
  this.setParent = function(parent) {
    this.parent = parent;
    if (this.tracker)
      this.tracker.setContainer(parent);
    checkTracker();
  };
  
  this.rebuild = function() {
    $elem.tabs(tabs_cfg);
    self.tablist.sortable(sortable_cfg);
  };
  
  this.resetTabs = function() {
    $elem.tabs('destroy');
    $elem.tabs(tabs_cfg);
    restoreActive();
  };
  
  master.registerDock(this);
  build();
  
  function build() {
    $elem.empty();
    
    self.tablist = generateTablist();
    $elem.append(self.tablist);
    
    $elem.tabs(tabs_cfg);
    self.tablist.sortable(sortable_cfg);
    
    self.tablist.on('click.ui-dock', 'span.ui-icon-close', function(event) {
      self.master.deleteView($(event.target).data('view_id'));
    });
    
    checkTracker();
  }
  
  function checkTracker() {
    if (!self.parent)
      return;

    if (self.parent.level < master.options['maxDepth'] && self.tracker == null)
      tracker = self.tracker = new DropTracker(self);
    else if (self.parent.level >= master.options['maxDepth'])
      tracker = self.tracker = null;
  }
  
  function generateTablist() {
    return $('<ul>', {
      class: 'ui-dock-tablist'
    });
  }
  
  function refreshTabs() {
    $elem.tabs('refresh');
    restoreActive();
    self.tablist.sortable('refresh');
  }
  
  function restoreActive() {
    if (active) {
      var view = views[active];
      if (view) {
        $elem.tabs('option', 'active', view.tab.getTabItem().index());
        return;        
      }
    }
    
    $elem.tabs('option', 'active', 0);
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
      return this.prime.passView(view);
    else 
      return this.leaf.addView(view);
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
    if (this.parent)
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
    
    master.unregisterDock(closed.leaf);
    
    if (this.isSplit()) {
      this.prime.parent = this;
      this.prime.level -= 1; 
      this.second.parent = this;
      this.second.level -= 1;

      this.resetLayout();
    } else {
      this.leaf.setParent(this);
      
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
    var paneMinSize = master.options['paneMinSize'];
    var paneMaxSize = master.options['paneMaxSize'];
    
    self.layout = self.$elem.layout({
      applyDefaultStyles : false,
      north__size : '50%',
      south__size : '50%',
      east__size : '50%',
      west__size : '50%',
      
      north__minSize : paneMinSize,
      south__minSize : paneMinSize,
      east__minSize : paneMinSize,
      west__minSize : paneMinSize,
      
      north__maxSize : paneMaxSize,
      south__maxSize : paneMaxSize,
      east__maxSize : paneMaxSize,
      west__maxSize : paneMaxSize
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
  
  this.setContainer = function(cont) {
    container = cont;
    $elem = container.$elem;
  };

  this.startTracking = function() {
    this.updateMap();
    $elem.append($hl);
    dock.master.$root.on('mousemove.ui-dock', check);
  };

  this.endTracking = function(viewID, originID) {
    var moved = false;
    dock.master.$root.off('mousemove.ui-dock');
    $hl.remove();
    
    if (currentRegion !== false) {
      var newContainer = container.split(currentRegion);
      var view = master.docks[originID].closeView(viewID);
      newContainer.passView(view);
      
      moved = true;
    }
    
    this.clearHighlight();
    
    return moved;
  };
  
  this.clearHighlight = function() {
    currentRegion = false;
    $hl.css('visibility', 'hidden');
  };

  this.updateMap = function() {
    var spanRatioX = parseSpanOption(master.options['highlightSpanX']);
    var spanRatioY = parseSpanOption(master.options['highlightSpanY']);
    
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
      x : dim.w * spanRatioX,
      y : dim.h * spanRatioY
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
    
    var tablistOffset = dock.tablist.offset();
    map.tablist = {
      x : tablistOffset.left,
      y : tablistOffset.top,
      w : dock.tablist.width(),
      h : dock.tablist.height()
    };
    
    function parseSpanOption(value) {
      if (typeof value === 'string' && value.slice(-1) === '%')
        return value.slice(0, -1) / 100;
      return value;
    }
  };
  
  function check (event, ui) {
    highlightRegion(computeRegion(event.pageX, event.pageY));
  };
    
  function computeRegion(x, y) {
    // Check if cursor is out of dock boundaries
    if (x < map.pos.x 
        || x > map.pos.x + map.dim.w
        || y < map.pos.y
        || y > map.pos.y + map.dim.h)
        return false;
        
    // Check if it is over tablist
    if (x > map.tablist.x
        && y > map.tablist.y
        && x < map.tablist.x + map.tablist.w
        && y < map.tablist.y + map.tablist.h)
        return false;
        
    if (master.options['verticalPriority'])
      return checkVertical() || checkHorizontal();
    
    return checkHorizontal() || checkVertical();
    
    function checkHorizontal() {
      if (y < map.bounds.top && master.options.NORTH)
        return Regions.NORTH;
      if (y > map.bounds.bottom && master.options.SOUTH)
        return Regions.SOUTH;

      return false;
    }
    
    function checkVertical() {
      if (x < map.bounds.left && master.options.WEST)
        return Regions.WEST;
      if (x > map.bounds.right && master.options.EAST)
        return Regions.EAST;

      return false;
    }
  }
  
  function highlightRegion(region) {
    if (region != currentRegion) {
      if (region === false)
        self.clearHighlight();
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
}

