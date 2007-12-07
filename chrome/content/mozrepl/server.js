/*
  Copyright (C) 2006 by Massimiliano Mirra

  This program is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation; either version 2 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program; if not, write to the Free Software
  Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301 USA

  Author: Massimiliano Mirra, <bard [at] hyperstruct [dot] net>
*/


// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

const Cc = Components.classes;
const Ci = Components.interfaces;
const loader = Cc['@mozilla.org/moz/jssubscript-loader;1']
    .getService(Ci.mozIJSSubScriptLoader);
const pref = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.mozlab.mozrepl.');

function REPL() {};
loader.loadSubScript('chrome://mozlab/content/mozrepl/repl.js', REPL.prototype);


// STATE
// ----------------------------------------------------------------------

var serv;


// CODE
// ----------------------------------------------------------------------

var sessions = {
    _list: [],
    
    add: function(session) {
        this._list.push(session);
    },

    remove: function(session) {
        var index = this._list.indexOf(session);
        if(index != -1)
            this._list.splice(index, 1);
    },

    get: function(index) {
        return this._list[index];
    },

    quit: function() {
        this._list.forEach(
            function(session) { session.quit; });
        this._list.splice(0, this._list.length);
    }
};


function init() {
    if(pref.getBoolPref('autoStart'))
        start(pref.getIntPref('port'));
}

function start(port) {
    try {
        serv = Cc['@mozilla.org/network/server-socket;1']
            .createInstance(Ci.nsIServerSocket);
        serv.init(port, pref.getBoolPref('loopbackOnly'), -1);
        serv.asyncListen(this);
        log('MozRepl: Listening...');
    } catch(e) {
        log('MozRepl: Exception: ' + e);
    }    
}

function onSocketAccepted(serv, transport) {
    try {
        var outstream = transport.openOutputStream(Ci.nsITransport.OPEN_BLOCKING , 0, 0);

        var stream = transport.openInputStream(0, 0, 0);
        var instream = Cc['@mozilla.org/intl/converter-input-stream;1']
            .createInstance(Ci.nsIConverterInputStream);
        instream.init(stream, 'UTF-8', 1024,
                      Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
    } catch(e) {
        log('MozRepl: Error: ' + e);
    }
    log('MozRepl: Accepted connection.');

    var window = Cc['@mozilla.org/appshell/window-mediator;1']
        .getService(Ci.nsIWindowMediator)
        .getMostRecentWindow('');

    var session = new REPL();
    session.onOutput = function(string) {
        outstream.write(string, string.length);
    };
    session.onQuit = function() {
        instream.close();
        outstream.close();
        sessions.remove(session);
    };
    session.init(window);

    var pump = Cc['@mozilla.org/network/input-stream-pump;1']
        .createInstance(Ci.nsIInputStreamPump);
    pump.init(stream, -1, -1, 0, 0, false);
    pump.asyncRead({
        onStartRequest: function(request, context) {},
        onStopRequest: function(request, context, status) {
                session.quit();
            },
        onDataAvailable: function(request, context, inputStream, offset, count) {
            var str = {}
            instream.readString(count, str)
            session.receive(str.value);
            }
        }, null);  

    sessions.add(session);
}

function onStopListening(serv, status) {
}


function stop() {
    log('MozRepl: Closing...');
    serv.close();
    sessions.quit();
    serv = undefined;
}
 
function isActive() {
    if(serv)
        return true;
} 


// UTILITIES
// ----------------------------------------------------------------------

function log(msg) {
    dump(msg + '\n');
}
