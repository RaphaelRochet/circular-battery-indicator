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
const UPower = imports.gi.UPowerGlib;

const Main = imports.ui.main;
const Panel = imports.ui.panel;

const CircularBatteryIndicator = GObject.registerClass(
	{
		_percentage: null,
		_charging: false,
		_idle: false,
		_origIndicator: null,
		_indicator: null,
		_repaintId: null,
		_powerProxyId: null,
	},
class CircularBatteryIndicator extends GObject.Object {

	_init() {
		this._origIndicator = this._power._indicator;
		this._indicator = new St.DrawingArea({ y_align: Clutter.ActorAlign.CENTER });

		this._indicator.set_width(Panel.PANEL_ICON_SIZE);
		this._indicator.set_height(Panel.PANEL_ICON_SIZE);

		// gfx
		this._power.replace_child(this._origIndicator, this._indicator);
		this._repaintId = this._indicator.connect("repaint", this._paintIndicator.bind(this));

		// events
		this._powerProxyId = this._power._proxy.connect('g-properties-changed', this._onPowerChanged.bind(this));

		this._onPowerChanged();
	}

	get _power() {
		return Main.panel.statusArea.aggregateMenu._power;
	}

	_onPowerChanged() {
		if (this._power._proxy.IsPresent) {
			this._percentage = this._power._proxy.Percentage;
			this._charging = this._power._proxy.State == UPower.DeviceState.CHARGING ;
			this._idle = this._power._proxy.State == UPower.DeviceState.FULLY_CHARGED
						|| this._power._proxy.State == UPower.DeviceState.PENDING_CHARGE ;
		} else {
			this._percentage = null;
			this._idle = false;
			this._charging = false;
		}
		this.updateDisplay();
	}

	updateDisplay() {
		if (this._percentage) {
			this._indicator.queue_repaint();
		}
	}

	destroy() {
		this._power.replace_child(this._indicator, this._origIndicator);
		this._indicator.disconnect(this._repaintId);
		this._power._proxy.disconnect(this._powerProxyId);
		this._indicator.destroy();
	}

	_paintIndicator(area) {
		let ctx = area.get_context();

		let themeNode = this._indicator.get_theme_node();
		let color = themeNode.get_foreground_color();

		let areaWidth = area.get_width();
		let areaHeight = area.get_height();

		let outer = Math.min(areaHeight, areaWidth ) / 2;
		let width = outer * 0.285;
		let inner = outer - (width / 2);

		Clutter.cairo_set_source_color(ctx, color.darken().darken());
		ctx.save();
		ctx.translate(areaWidth / 2.0, areaHeight / 2.0);
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
}
