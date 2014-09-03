'use strict';

var isMouseOut = require('../utils/isMouseOut');
var loadPage = require('../components/loadPage');
var transitionEndEvent = require('../utils/transitionEndEvent')();
var waitAnimationFrames = require('../utils/waitAnimationFrames');

var PanelsNav = require('./components/PanelsNav');
var ScrollEvents = require('../components/ScrollEvents');
var TransitionWatcher = require('../components/TransitionWatcher');

function Panels () {
	this.el = document.getElementById('panels');
	this.nav = new PanelsNav();
	this.panels = document.querySelectorAll('#panels .panel');
	this.panels = Array.prototype.slice.call(this.panels);
	this.panelsUrlMap = {};
	this.totalPanels = this.panels.length;
	this.currentIndex = -1;

	this.onMouseOver = this.onMouseOver.bind(this);
	this.onMouseOut = this.onMouseOut.bind(this);
	this.onScrolledToEnd = this.onScrolledToEnd.bind(this);
	this.onScrolledToPoint = this.onScrolledToPoint.bind(this);
	this.onPanelsLoaded = this.onPanelsLoaded.bind(this);
	this.onNavClicked = this.onNavClicked.bind(this);

	if (document.body.classList.contains('is-panels', 'is-intro')) {
		this.introWatcher = new TransitionWatcher();
		this.onIntroEnded = this.onIntroEnded.bind(this);
		this.panels[this.totalPanels - 1].addEventListener(transitionEndEvent, this.onIntroEnded, false);
	}
	else {
		this.enable();
	}
}

var proto = Panels.prototype;

proto.show = function (url) {
	this.el.classList.remove('is-hidden');
	this.watcher = this.transitionFromPost(url);
	return this.watcher;
};

proto.hide = function () {
	this.el.classList.add('is-hidden');
};

proto.addPanels = function (index, append) {
	function callback (index) {
		return function () {
			this.onPanelMouseOver(index);
		};
	}
	// TODO: add `is-shrunk-right` to the first added element if append is `true` and we're hovering
	var panel;
	var i = index || 0;
	for (i; i < this.totalPanels; ++i) {
		panel = this.panels[i];
		panel.addEventListener('mouseover', callback(i).bind(this), false);
		this.panelsUrlMap[panel.pathname] = {
			index: i,
			panel: panel
		};
		if (append) {
			this.el.appendChild(panel);
		}
	}
};

proto.addExpandClass = function () {
	this.panels[this.currentIndex].classList.add('is-expanded');

	if (this.currentIndex > 0) {
		this.panels[this.currentIndex - 1].classList.add('is-shrunk-left');
	}

	if (this.currentIndex < this.totalPanels - 1) {
		this.panels[this.currentIndex + 1].classList.add('is-shrunk-right');
	}
};

proto.removeExpandClass = function () {
	if (this.currentIndex > -1) {
		this.panels[this.currentIndex].classList.remove('is-expanded');

		if (this.currentIndex > 0) {
			this.panels[this.currentIndex - 1].classList.remove('is-shrunk-left');
		}

		if (this.currentIndex < this.totalPanels - 1) {
			this.panels[this.currentIndex + 1].classList.remove('is-shrunk-right');
		}
	}
};

proto.onIntroEnded = function (evt) {
	this.panels[this.totalPanels - 1].removeEventListener(transitionEndEvent, this.onIntroEnded);
	this.enable();
	this.introWatcher.complete();

	var onMouseMove = function (evt) {
		document.removeEventListener('mousemove', onMouseMove);
		var index = this.panels.indexOf(evt.target);
		if (index > -1) {
			this.onMouseOver();
			this.onPanelMouseOver(index);
		}
	}.bind(this);
	document.addEventListener('mousemove', onMouseMove, false);
};

proto.onPanelMouseOver = function (index) {
	if (this.currentIndex != index) {
		this.removeExpandClass();
		this.currentIndex = index;
		this.addExpandClass();
	}
};

proto.onMouseOver = function (evt) {
	this.el.removeEventListener('mouseover', this.onMouseOver);
	this.el.addEventListener('mouseout', this.onMouseOut, false);
	this.el.classList.add('is-hovered');
};

proto.onMouseOut = function (evt) {
	if (evt === undefined || isMouseOut(evt)) {
		this.el.removeEventListener('mouseout', this.onMouseOut);
		this.el.addEventListener('mouseover', this.onMouseOver, false);
		this.el.classList.remove('is-hovered');

		if (this.currentIndex > -1) {
			this.removeExpandClass();
			this.currentIndex = -1;
		}
	}
};

proto.onPanelsLoaded = function (panels, nav) {

	this.nav.setLoading(false);
	this.panels = this.panels.concat(Array.prototype.slice.call(panels));
	var index = this.totalPanels;
	this.totalPanels = this.panels.length;
	this.addPanels(index, true);

	this.scrollEvents.addPoint(this.scrollEvents.widthMinusWindow + this.panels[0].offsetWidth);
	this.el.addEventListener('reachedpoint', this.onScrolledToPoint, false);
	this.nav.el.addEventListener('click', this.onNavClicked, false);

	if (nav[0]) {
		this.nav.setPath(nav[0].href);
		this.scrollEvents.update(this.el);
		this.el.addEventListener('reachedend', this.onScrolledToEnd, false);
	}
	else {
		this.allPanelsLoaded = true;
	}
};

proto.onScrolledToEnd = function (evt) {
	this.el.removeEventListener('reachedend', this.onScrolledToEnd);
	this.nav.setLoading(true);
	loadPage(this.nav.getPath(), this.onPanelsLoaded, '#panels .panel', '#panels-nav');
};

proto.onScrolledToPoint = function (evt) {
	this.el.removeEventListener('reachedpoint', this.onScrolledToPoint);
	this.scrollEvents.clearPoints();
	this.nav.hide();
	if (this.allPanelsLoaded) {
		this.scrollEvents.disable();
	}
};

proto.onNavClicked = function (evt) {
	evt.preventDefault();
	if (!this.nav.getLoading()) {
		this.scrollEvents.scrollToPoint(0);
		this.onScrolledToPoint();
		this.nav.el.removeEventListener('click', this.onNavClicked);
	}
};

proto.getCurrentColor = function (url) {
	var panel = this.currentIndex ? this.panels[this.currentIndex] : this.panelsUrlMap[url].panel;
	return panel.dataset.color;
};

proto.transitionToPost = function () {
	var listenTo;
	var panelWidth = this.panels[0].offsetWidth;
	var panelExpandWidth = 25; // actually half the expand width - maybe make this dynamic?
	var winWidth = window.innerWidth;
	var scrollLeft = window.pageXOffset;
	var slideAmount = winWidth - ((this.panels[this.currentIndex].offsetLeft - scrollLeft) + panelWidth + panelExpandWidth);
	var style = '-webkit-transform: translateX(' + slideAmount + 'px); transform: translateX(' + slideAmount + 'px)';
	var i = this.currentIndex;
	this.transformed = [];

	while (++i && i < this.totalPanels) {
		if (this.panels[i].offsetLeft - scrollLeft < winWidth) {
			this.transformed.push(this.panels[i]);
			this.panels[i].style.cssText = style;
			if (listenTo === undefined) {
				listenTo = this.panels[i];
			}
		}
		else {
			i = Infinity;
		}
	}

	slideAmount = this.panels[this.currentIndex].offsetLeft - scrollLeft - panelExpandWidth;
	style = '-webkit-transform: translateX(-' + slideAmount + 'px); transform: translateX(-' + slideAmount + 'px)';
	scrollLeft -= panelWidth;
	i = this.currentIndex;

	while (i--) {
		if (this.panels[i].offsetLeft - scrollLeft) {
			this.transformed.push(this.panels[i]);
			this.panels[i].style.cssText = style;
			if (listenTo === undefined) {
				listenTo = this.panels[i];
			}
		}
		else {
			i = -1;
		}
	}

	var watcher = new TransitionWatcher();
	var onTransitionEnded = function (evt) {
		listenTo.removeEventListener(transitionEndEvent, onTransitionEnded);
		watcher.complete();
	};
	listenTo.addEventListener(transitionEndEvent, onTransitionEnded, false);
	return watcher;
};

proto.transitionFromPost = function (url) {
	var panelObj = this.panelsUrlMap[url];

	if (panelObj === undefined) {
		// panel not loaded - do fade instead
		// also check if any panels, if not, load
		// them or wait until they have loaded
		return;
	}

	var listenTo;
	var panelWidth = this.panels[0].offsetWidth;
	var winWidth = window.innerWidth;
	var panelOffsetLeft = panelObj.panel.offsetLeft;
	var midPoint = winWidth * 0.5;
	var left = panelOffsetLeft + (panelWidth * 0.5);
	var scrollLeft = Math.round(left - midPoint);

	window.scrollTo(scrollLeft, 0);

	var slideAmount = winWidth - ((panelOffsetLeft - scrollLeft) + panelWidth);
	var style = '-webkit-transform: translateX(' + slideAmount + 'px); transform: translateX(' + slideAmount + 'px)';
	var i = panelObj.index;
	this.transformed = [];

	while (++i && i < this.totalPanels) {
		if (this.panels[i].offsetLeft - scrollLeft < winWidth) {
			this.transformed.push(this.panels[i]);
			this.panels[i].style.cssText = style;
			if (listenTo === undefined) {
				listenTo = this.panels[i];
			}
		}
		else {
			i = Infinity;
		}
	}

	slideAmount = panelOffsetLeft - scrollLeft;
	style = '-webkit-transform: translateX(-' + slideAmount + 'px); transform: translateX(-' + slideAmount + 'px)';
	scrollLeft -= panelWidth;
	i = panelObj.index;

	while (i--) {
		if (this.panels[i].offsetLeft - scrollLeft) {
			this.transformed.push(this.panels[i]);
			this.panels[i].style.cssText = style;
			if (listenTo === undefined) {
				listenTo = this.panels[i];
			}
		}
		else {
			i = -1;
		}
	}

	panelObj.panel.classList.add('is-transition-panel');
	var watcher = new TransitionWatcher();

	waitAnimationFrames(function () {
		document.body.classList.remove('is-transition-topanelsfrompost');
		panelObj.panel.classList.remove('is-transition-panel');
		this.resetTransition();

		var onTransitionEnded = function (evt) {
			listenTo.removeEventListener(transitionEndEvent, onTransitionEnded);
			watcher.complete();
		};
		listenTo.addEventListener(transitionEndEvent, onTransitionEnded, false);
	}.bind(this), 2);

	return watcher;
};

proto.resetTransition = function () {
	var i = this.transformed.length;
	while (i--) {
		this.transformed[i].style.cssText = '';
	}
	this.transformed = undefined;
	this.onMouseOut();
};

proto.enable = function () {
	if (this.el) {
		this.el.addEventListener('mouseover', this.onMouseOver, false);
		this.el.addEventListener('reachedend', this.onScrolledToEnd, false);
		this.addPanels();
		if (this.nav.hasEl() && this.scrollEvents === undefined) {
			this.scrollEvents = new ScrollEvents(this.el);
		}
	}
};

proto.disable = function () {
	if (this.el) {
		this.el.removeEventListener('mouseover', this.onMouseOver);
		this.el.removeEventListener('mouseout', this.onMouseOut);
	}
};

module.exports = Panels;
