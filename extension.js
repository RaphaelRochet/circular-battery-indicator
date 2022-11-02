/*  

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

    Copyright (C) 2017 Yannick Tanner
    Copyright (C) 2022 Raphaël Rochet

**/

const St = imports.gi.St;
const GObject = imports.gi.GObject;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const UPower = imports.gi.UPowerGlib;

const Main = imports.ui.main;
const Panel = imports.ui.panel;

const CircularBatteryIndicator = GObject.registerClass(
	{
		_pT: null,				// the PowerToggle instance
		_old_qs_icon: null,		// ref to icon in quickSettings we replace (to put it back later)
		_indic_box: null, 		// ref to indicator container (contains battery icon and percentage text)
		_old_indic_icon: null,	// ref to indicator icon we replace (to put it back later)
		_qs_drawing: null,		// drawing replacement for QuickSettings panel
		_indic_drawing: null,	// drawing replacement for indicator panel
		_percentage: null,		// % full
		_charging: null,		// is battery charging
		_idle: null,			// is plugged but not charging
		// Various event Id we shall track to disable later
		_TimeoutId: null,
		_qs_repaintId: null,
		_indic_repaintId: null,
		_powerProxyId: null,
	},

class CircularBatteryIndicator extends GObject.Object {

	_init() {
		// Prepare drawing areas
		this._indic_drawing = new St.DrawingArea({ y_align: Clutter.ActorAlign.CENTER });
		this._indic_drawing.set_width(Panel.PANEL_ICON_SIZE);
		this._indic_drawing.set_height(Panel.PANEL_ICON_SIZE);
		this._indic_drawing.add_style_class_name('circular-battery-indicator');
		this._qs_drawing = new St.DrawingArea({ y_align: Clutter.ActorAlign.CENTER });
		this._qs_drawing.set_width(Panel.PANEL_ICON_SIZE);
		this._qs_drawing.set_height(Panel.PANEL_ICON_SIZE);
		this.patch();
	}

	patch() {
		if (this._TimeoutId) GLib.source_remove(this._TimeoutId);
		if (this._pT) {
			return;
		}
		var PowerToggle = imports.ui.status.system.PowerToggle;
		if (!PowerToggle) {
			this._TimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, ()=>{this.patch();	return true;});
			return;
		}
		// Replace indicator icon with our drawing
		// We don't want to mess with battery percentage text but focus on the icon
		this._old_indic_icon = Main.panel.statusArea.quickSettings._system._indicator;
		this._indic_box = Main.panel.statusArea.quickSettings._system._indicator.get_parent();
		this._indic_box.replace_child(this._old_indic_icon, this._indic_drawing);
		this._indic_repaintId = this._indic_drawing.connect("repaint", this.draw.bind(this));
		// Replace quicksettings battery icon by our drawing and capture repaint event
		this._pT = Main.panel.statusArea.quickSettings._system._systemItem._powerToggle;
		this._old_qs_icon = this._pT._icon;
		this._pT._box.replace_child(this._pT._icon, this._qs_drawing);
		this._qs_repaintId = this._qs_drawing.connect("repaint", this.draw.bind(this));
		// React to power changes
		let proxy = this._pT._proxy;
		this._powerProxyId = proxy.connect('g-properties-changed', this._onPowerChanged.bind(this));
		// React to setting
		this._desktopSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
		this._desktopSettings.connect('changed::show-battery-percentage', this._onPowerChanged.bind(this));
		// Update now
		this._onPowerChanged();
	}

	destroy() {
		if (this._TimeoutId) GLib.source_remove(this._TimeoutId);
		if (this._pT) {
			// Put icons back in place
			this._pT._box.replace_child(this._qs_drawing, this._old_qs_icon);
			this._indic_box.replace_child(this._indic_drawing, this._old_indic_icon);
			// Disconnect from events
			this._qs_drawing.disconnect(this._qs_repaintId);
			this._indic_drawing.disconnect(this._indic_repaintId);
			this._pT._proxy.disconnect(this._powerProxyId);
			// Force sync
			Main.panel.statusArea.quickSettings._system._systemItem._powerToggle._sync();
		}
	}

	_onPowerChanged() {
		let proxy = this._pT._proxy;
		if (proxy.IsPresent) {
			this._percentage = proxy.Percentage;
			this._charging = proxy.State == UPower.DeviceState.CHARGING ;
			this._idle = proxy.State == UPower.DeviceState.FULLY_CHARGED
						|| proxy.State == UPower.DeviceState.PENDING_CHARGE ;
		} else {
			this._percentage = null;
			this._idle = false;
			this._charging = false;
		}
		this.update();
	}

	update() {
		this._indic_drawing.queue_repaint();
		this._qs_drawing.queue_repaint();
	}

	draw(area) {
		let ctx = area.get_context();

		let themeNode = this._indic_drawing.get_theme_node();
		let color = themeNode.get_foreground_color();

		let areaWidth = area.get_width();
		let areaHeight = area.get_height();

		let outer = Math.min(areaHeight, areaWidth ) / 2;
		let width = outer * 0.285;
		let inner = outer - (width / 2);

		Clutter.cairo_set_source_color(ctx, color.darken().darken());
		ctx.save();
		ctx.translate(areaHeight / 2.0, areaHeight / 2.0);
		ctx.rotate(3 / 2 * Math.PI);

		ctx.setLineWidth(width);
		ctx.arc(0, 0, inner, 0, 2 * Math.PI);
		ctx.stroke();

		Clutter.cairo_set_source_color(ctx, color);
		ctx.setLineWidth(width);
		ctx.arc(0, 0, inner, 0, (this._percentage / 100) * 2 * Math.PI);
		ctx.stroke();

		if (this._charging) {
			ctx.arc(0, 0, inner - width * 1.4, 0, 2 * Math.PI);
			ctx.fill();
		}

		if (this._idle) {
			Clutter.cairo_set_source_color(ctx, color.darken().darken());
			ctx.arc(0, 0, inner - width * 1.4, 0, 2 * Math.PI);
			ctx.fill();
		}

		ctx.restore();
	}
});

let circularbatteryindicator;

function enable() {
	circularbatteryindicator = new CircularBatteryIndicator();
}

function disable() {
	circularbatteryindicator.destroy();
	circularbatteryindicator = null;
}
