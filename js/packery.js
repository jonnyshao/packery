/**
 * Packery v0.0.1
 * Bin-packing layout
 * by David DeSandro / Metafizzy
 */

( function( window ) {

'use strict';

// Packery classes
var _Packery = window.Packery;
var Rect = _Packery.Rect;
var Packer = _Packery.Packer;
var Item = _Packery.Item;

// dependencies
var classie = window.classie;
var EventEmitter = window.EventEmitter;
var eventie = window.eventie;
var getSize = window.getSize;
var matchesSelector = window.matchesSelector;

// -------------------------- helpers -------------------------- //

// extend objects
function extend( a, b ) {
  for ( var prop in b ) {
    a[ prop ] = b[ prop ];
  }
  return a;
}

// turn element or nodeList into an array
function makeArray( obj ) {
  var ary = [];
  if ( obj.length ) {
    // convert nodeList to array
    for ( var i=0, len = obj.length; i < len; i++ ) {
      ary.push( obj[i] );
    }
  } else {
    // array of single index
    ary.push( obj );
  }
  return ary;
}

// -------------------------- Packery -------------------------- //

function Packery( element, options ) {
  if ( !element ) {
    console.error( element + ' Packery element' );
    return;
  }

  this.element = element;

  // options
  this.options = extend( {}, this.options );
  extend( this.options, options );

  // initial properties
  this.packer = new Packer();

  // kick it off
  this._create();
  this.layout();

}

// inherit EventEmitter
extend( Packery.prototype, EventEmitter.prototype );

// default options
Packery.prototype.options = {
  containerStyle: {
    position: 'relative'
  },
  isResizable: true,
  transitionDuration: '0.4s'
};

Packery.prototype._create = function() {
  this.layoutCount = 0;

  this.reloadItems();

  // collection of element that don't get laid out
  this.placedElements = [];
  if ( this.options.placedElements ) {
    this.place( this.options.placedElements );
  }

  var containerStyle = this.options.containerStyle;
  extend( this.element.style, containerStyle );

  // bind resize method
  if ( this.options.isResizable ) {
    eventie.bind( window, 'resize', this );
  }

  // create drag handlers
  var _this = this;
  this.handleDraggabilly = {
    start: function handleDraggabillyStart( event, pointer, draggie ) {
      _this.itemDragStart( draggie.element );
    },
    drag: function handleDraggabillyDrag( event, pointer, draggie ) {
      _this.itemDragMove( draggie.element, draggie.position.x, draggie.position.y );
    },
    stop: function handleDraggabillyStop( event, pointer, draggie ) {
      _this.itemDragStop( draggie.element );
    }
  };

  this.handleUIDraggable = {
    start: function handleUIDraggableStart( event ) {
      _this.itemDragStart( event.currentTarget );
    },
    drag: function handleUIDraggableDrag( event, ui ) {
      _this.itemDragMove( event.currentTarget, ui.position.left, ui.position.top );
    },
    stop: function handleUIDraggableStop( event ) {
      _this.itemDragStop( event.currentTarget );
    }
  };

};

// goes through all children again and gets bricks in proper order
Packery.prototype.reloadItems = function() {
  // collection of item elements
  this.items = this._getItems( this.element.children );
};


/**
 * get item elements to be used in layout
 * @param {Array or NodeList or HTMLElement} elems
 * @returns {Array} items - collection of new Packery Items
 */
Packery.prototype._getItems = function( elems ) {

  var itemElems = this._filterFindItemElements( elems );

  // create new Packery Items for collection
  var items = [];
  var elem, item;
  for ( var l=0, lLen = itemElems.length; l < lLen; l++ ) {
    elem = itemElems[l];
    item = new Item( elem, this );
    items.push( item );
  }

  return items;
};

/**
 * get item elements to be used in layout
 * @param {Array or NodeList or HTMLElement} elems
 * @returns {Array} items - item elements
 */
Packery.prototype._filterFindItemElements = function( elems ) {
  // make array of elems
  elems = makeArray( elems );
  var itemSelector = this.options.itemSelector;

  if ( !itemSelector ) {
    return elems;
  }

  var itemElems = [];

  // filter & find items if we have an item selector
  var elem;
  for ( var i=0, len = elems.length; i < len; i++ ) {
    elem = elems[i];
    // filter siblings
    if ( matchesSelector( elem, itemSelector ) ) {
      itemElems.push( elem );
    }
    // find children
    var childElems = elem.querySelectorAll( itemSelector );
    // concat childElems to filterFound array
    for ( var j=0, jLen = childElems.length; j < jLen; j++ ) {
      itemElems.push( childElems[j] );
    }
  }

  return itemElems;
};

/**
 * getter method for getting item elements
 * @returns {Array} elems - collection of item elements
 */
Packery.prototype.getItemElements = function() {
  var elems = [];
  for ( var i=0, len = this.items.length; i < len; i++ ) {
    elems.push( this.items[i].element );
  }
  return elems;
};

// ----- init & layout ----- //

Packery.prototype.layout = function() {
  // reset packer
  this.elementSize = getSize( this.element );

  this.packer.width = this.elementSize.innerWidth;
  this.packer.height = Number.POSITIVE_INFINITY;
  this.packer.reset();

  // layout
  this.maxY = 0;
  this.spacePlacedElements();
  // don't animate first layout
  this.layoutItems( this.items, !this._isInited );

  // flag for initalized
  this._isInited = true;
};

// _init is alias for layout
Packery.prototype._init = Packery.prototype.layout;

/**
 * layout a collection of item elements
 * @param {Array} items - array of elements
 * @param {Boolean} isStill - disable transitions for setting item position
 */
Packery.prototype.layoutItems = function( items, isStill ) {
  // console.log('layout Items');
  var item;
  var layoutItemCount = this._getLayoutItemCount();
  var completedItemLayouts = 0;

  var _this = this;
  function onItemLayout() {
    completedItemLayouts++;
    // console.log('completed itemLayouts', iItem._i );
    // trigger callback
    if ( completedItemLayouts === layoutItemCount ) {
      _this.layoutCount++;
      _this.emitEvent( 'layoutComplete', [ _this ] );
    }
    // listen once
    return true;
  }

  for ( var i=0, len = items.length; i < len; i++ ) {
    item = items[i];
    // ignore item
    if ( item.isIgnored ) {
      continue;
    }
    // listen to layout events for callback
    item.on( 'layout', onItemLayout );
    this._packItem( item );
    this._layoutItem( item, isStill );
  }

  // set container size
  this.element.style.height = this.maxY + 'px';
};

/**
 * get the number of un-ignored items that will be laid out
 * @returns {Number} count
 */
Packery.prototype._getLayoutItemCount = function() {
  var count = 0;
  for ( var i=0, len = this.items.length; i < len; i++ ) {
    count += this.items[i].isIgnored ? 0 : 1;
  }
  return count;
};

/**
 * layout item in packer
 * @param {Packery.Item} item
 */
Packery.prototype._packItem = function( item ) {
  // console.log( item );
  var size = getSize( item.element );
  var w = size.outerWidth;
  var h = size.outerHeight;
  // size for columnWidth and rowHeight, if available
  var colW = this.options.columnWidth;
  var rowH = this.options.rowHeight;
  w = colW ? Math.ceil( w / colW ) * colW : w;
  h = rowH ? Math.ceil( h / rowH ) * rowH : h;

  var rect = item.rect;
  rect.width = w;
  rect.height = h;
  // pack the rect in the packer
  this.packer.pack( rect );

  this.maxY = Math.max( rect.y + rect.height, this.maxY );
};

/**
 * Sets position of item in DOM
 * @param {Packery.Item} item
 * @param {Boolean} isStill - disables transitions
 */
Packery.prototype._layoutItem = function( item, isStill ) {

  // copy over position of packed rect to item element
  var rect = item.rect;
  if ( isStill ) {
    // if not transition, just set CSS
    item.setPosition( rect.x, rect.y );
    item.layoutPosition();
  } else {
    item.transitionPosition( rect.x, rect.y );
  }

};

// -------------------------- place -------------------------- //

/**
 * adds elements to placedElements
 * @param {NodeList, Array, or Element} elems
 */
Packery.prototype.place = function( elems ) {
  if ( !elems ) {
    return;
  }
  elems = makeArray( elems );
  this.placedElements.push.apply( this.placedElements, elems );
};

Packery.prototype.unplace = function( elems ) {
  elems = makeArray( elems );
  var revised = [];
  var placedElem;
  // filter out removed place elements
  for ( var i=0, len = this.placedElements.length; i < len; i++ ) {
    placedElem = this.placedElements[i];
    if ( elems.indexOf( placedElem ) === -1 ) {
      revised.push( placedElem );
    }
  }

  this.placedElements = revised;
};

// make spaces for placed elements
Packery.prototype.spacePlacedElements = function() {
  if ( !this.placedElements || !this.placedElements.length ) {
    return;
  }
  // get bounding rect for container element
  var elementBoundingRect = this.element.getBoundingClientRect();
  this._boundingLeft = elementBoundingRect.left + this.elementSize.paddingLeft;
  this._boundingTop  = elementBoundingRect.top  + this.elementSize.paddingTop;

  for ( var i=0, len = this.placedElements.length; i < len; i++ ) {
    var elem = this.placedElements[i];
    this.spacePlaced( elem );
  }
};

// makes space for element
Packery.prototype.spacePlaced = function( elem ) {
  var size = getSize( elem );
  var rect;

  var item = this.getItemFromElement( elem );
  if ( item && item.placedRect ) {
    rect = item.placedRect;
  } else {
    var boundingRect = elem.getBoundingClientRect();
    rect = new Rect({
      x: boundingRect.left - this._boundingLeft,
      y: boundingRect.top - this._boundingTop
    });
  }

  rect.width = size.outerWidth;
  rect.height = size.outerHeight;

  // save its space in the packer
  this.packer.placed( rect );

  this.maxY = Math.max( rect.y + rect.height, this.maxY );
};

// -------------------------- resize -------------------------- //

Packery.prototype.handleEvent = function( event ) {
  var method = event.type + 'Handler';
  if ( this[ method ] ) {
    this[ method ]( event );
  }
};


// original debounce by John Hann
// http://unscriptable.com/index.php/2009/03/20/debouncing-javascript-methods/

// this fires every resize
Packery.prototype.resizeHandler = function( event ) {
  if ( event.target !== window ) {
    return;
  }

  if ( this.resizeTimeout ) {
    clearTimeout( this.resizeTimeout );
  }

  var _this = this;
  function delayed() {
    _this.resize();
  }

  this.resizeTimeout = setTimeout( delayed, 100 );
};

// debounced, layout on resize
Packery.prototype.resize = function() {
  // don't trigger if size did not change
  var size = getSize( this.element );
  if ( size.innerWidth === this.elementSize.innerWidth ) {
    return;
  }

  this.layout();

  delete this.resizeTimeout;
};


// -------------------------- methods -------------------------- //


/**
 * Layout newly-appended item elements
 * @param {Array or NodeList or Element} elems
 */
Packery.prototype.appended = function( elems ) {
  var items = this._getItems( elems );
  if ( !items.length ) {
    return;
  }

  // add items to collection
  this.items = this.items.concat( items );

  // layout just the new items
  this.layoutItems( items, true );

  // reveal new items
  var item;
  for ( var i=0, len = items.length; i < len; i++ ) {
    item = items[i];
    item.reveal();
  }
};

Packery.prototype.getItemFromElement = function( elem, callback ) {
  // loop through items to get the one that matches
  var item;
  for ( var i=0, len = this.items.length; i < len; i++ ) {
    item = this.items[i];
    if ( item.element === elem ) {
      // trigger callback
      if ( callback ) {
        callback( item, i );
      }
      // return item
      return item;
    }
  }
};

/**
 * remove element(s) from instance and DOM
 * @param {Array or NodeList or Element} elems
 */
Packery.prototype.remove = function( elems ) {
  elems = makeArray( elems );
  var elem;
  var _this = this;

  function removeItem( remItem, j ) {
    // remove item from collection
    remItem.remove();
    _this.items.splice( j, 1 );
  }

  for ( var i=0, len = elems.length; i < len; i++ ) {
    elem = elems[i];
    this.getItemFromElement( elem, removeItem );
  }
};

Packery.prototype.ignore = function( elem ) {
  var item = this.getItemFromElement( elem );
  if ( item ) {
    item.isIgnored = true;
  }
};

Packery.prototype.unignore = function( elem ) {
  var item = this.getItemFromElement( elem );
  if ( item ) {
    delete item.isIgnored;
  }
};

Packery.prototype.sortItemsByPosition = function() {
  // console.log('sortItemsByPosition');
  this.items.sort( function( a, b ) {
    return a.position.y - b.position.y || a.position.x - b.position.x;
  });
};

// -------------------------- drag -------------------------- //

Packery.prototype.itemDragStart = function( elem ) {
  this.ignore( elem );
  this.place( elem );
  var item = this.getItemFromElement( elem );
  if ( item ) {
    item.dragStart();
  }
};

Packery.prototype.itemDragMove = function( elem, x, y ) {
  var item = this.getItemFromElement( elem );
  if ( item ) {
    item.dragMove( x, y );
  }

  // debounce
  var _this = this;
  // use item for timer, or fall back to this
  var timer = item || this;
  function delayed() {
    _this.layout();
    delete timer._dragTimeout;
  }

  if ( timer._dragTimeout ) {
    clearTimeout( timer._dragTimeout );
  }

  timer._dragTimeout = setTimeout( delayed, 40 );
};

Packery.prototype.itemDragStop = function( elem ) {
  var item = this.getItemFromElement( elem );

  // check if item's current position matches placed rect position
  var isPositioningItem = false;
  var didItemDrag;
  if ( item ) {
    didItemDrag = item.didDrag;
    item.dragStop();
    isPositioningItem = item.needsPositioning;
  }

  // if elem didn't move, unignore and unplace and call it a day
  if ( !didItemDrag ) {
    this.unignore( elem );
    this.unplace( elem );
    return;
  }

  if ( item ) {
    classie.add( item.element, 'is-positioning-post-drag' );
  }

  var isItemPositioned = !isPositioningItem;
  var isPackeryLaidOut = false;
  var _this = this;
  function onLayoutComplete() {
    // only trigger when both are laid out
    // console.log('completeing clayout', isItemLaidOut, isPackeryLaidOut );
    if ( !isItemPositioned || !isPackeryLaidOut ) {
      return;
    }
    if ( item ) {
      classie.remove( item.element, 'is-positioning-post-drag' );
    }

    _this.unignore( elem );
    _this.unplace( elem );
    // only sort when item moved
    _this.sortItemsByPosition();
  }

  if ( isPositioningItem ) {
    item.on( 'layout', function onItemLayout() {
      isItemPositioned = true;
      onLayoutComplete();
      // listen once
      return true;
    });

    item.transitionPosition( item.placedRect.x, item.placedRect.y );
  }

  this.on( 'layoutComplete', function onPackeryLayoutComplete() {
    isPackeryLaidOut = true;
    onLayoutComplete();
    // listen once
    return true;
  });
  this.layout();

};

/**
 * binds Draggabilly events
 * @param draggie {Draggabilly}
 */
Packery.prototype.bindDraggabillyEvents = function( draggie ) {
  draggie.on( 'start', this.handleDraggabilly.start );
  draggie.on( 'drag', this.handleDraggabilly.drag );
  draggie.on( 'stop', this.handleDraggabilly.stop );
};

/**
 * binds jQuery UI Draggable events
 * @param {jQuery} $elems
 */
Packery.prototype.bindUIDraggableEvents = function( $elems ) {
  $elems
    .on( 'dragstart', this.handleUIDraggable.start )
    .on( 'drag', this.handleUIDraggable.drag )
    .on( 'dragstop', this.handleUIDraggable.stop );
};

// ----- destroy ----- //

// remove and disable Packery instance
Packery.prototype.destroy = function() {
  // reset element styles
  this.element.style.position = '';
  this.element.style.height = '';

  // destroy items
  for ( var i=0, len = this.items.length; i < len; i++ ) {
    var item = this.items[i];
    item.destroy();
  }

  eventie.unbind( window, 'resize', this );
};

// -----  ----- //

// back in global
Packery.Rect = Rect;
Packery.Packer = Packer;
window.Packery = Packery;

})( window );
