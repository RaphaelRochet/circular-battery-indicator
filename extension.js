/*  Copyright (C) 2017 Yannick Tanner

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Main = imports.ui.main;
const UPower = imports.gi.UPowerGlib;
const Panel = imports.ui.panel;

const CircularBatteryIndicatorHandler = new Lang.Class({
    Name: "CircularBatteryIndicatorHandler",

    _percentage: null,
    _charging: false,

    _origIndicator: null,
    _indicator: null,
    _repaintId: null,

    _powerProxyId: null,

    get _power() {
        return Main.panel.statusArea.aggregateMenu._power;
    },

    _init() {
        this._origIndicator = this._power._indicator;
    },

    enable() {
        this._indicator = new St.DrawingArea({ y_align: Clutter.ActorAlign.CENTER });

        this._indicator.set_width(1.6 * Panel.PANEL_ICON_SIZE);
        this._indicator.set_height(1.1 * Panel.PANEL_ICON_SIZE);

        let that = this;
        let power = this._power;

        // gfx
        power.indicators.replace_child(this._origIndicator, this._indicator);
        this._repaintId = this._indicator.connect("repaint", Lang.bind(this, this._paintIndicator));

        // events
        let _onPowerChanged = function() {
            if (this._proxy.IsPresent) {
                that._percentage = this._proxy.Percentage;
                that._charging = this._proxy.State == UPower.DeviceState.CHARGING 
                                || this._proxy.State == UPower.DeviceState.FULLY_CHARGED;
            } else {
                that._percentage = null;
            }
            that.updateDisplay.call(that);
        }

        this._powerProxyId = power._proxy.connect('g-properties-changed', Lang.bind(power, _onPowerChanged));
        _onPowerChanged.call(power);
    },

    disable() {
        this._power.indicators.replace_child(this._indicator, this._origIndicator);

        this._indicator.disconnect(this._repaintId);
        this._power._proxy.disconnect(this._powerProxyId);
        this._indicator.destroy();
    },

    updateDisplay() {
        if (this._percentage) {
            this._indicator.queue_repaint();
        }
    },

    // TODO: Seperate into own actor
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
            // TODO: Animation?
        }

        ctx.restore();
    }

});

function init() {
    return new CircularBatteryIndicatorHandler();
}
