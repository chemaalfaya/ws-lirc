var bonjour = require('bonjour')();
var mdns = require('mdns');
var WebSocketServer = require('websocket').server;
var http = require('http');
var nodeLIRC = require('node-lirc');

nodeLIRC.init();


var txt_record = {
    identifier: 'b8:27:eb:42:cf:61'
};
var ad = mdns.createAdvertisement(mdns.tcp('srp'), 8081, { name: 'SmartRemote_b8:27:eb:42:cf:61', txtRecord: txt_record });
ad.start();

//bonjour.publish({ name: 'SmartRemoteServer', type: 'srp', port: 8081});
var browser = bonjour.find({ type: 'srp' }, function (service) {
    console.log("HTTP Server found (bonjour): ", service);
});

var busy = false;

var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});

server.listen(8081, function() {
    console.log((new Date()) + ' Server is listening on port 8081');
});

wsServer = new WebSocketServer({
    httpServer: server,
    // You should not use autoAcceptConnections for production 
    // applications, as it defeats all standard cross-origin protection 
    // facilities built into the protocol and the browser.  You should 
    // *always* verify the connection's origin and decide whether or not 
    // to accept it. 
    autoAcceptConnections: false
});
 
function originIsAllowed(origin) {
    // put logic here to detect whether the specified origin is allowed. 
    return true;
}

wsServer.on('request', function(request){
    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin 
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }

    var connection = request.accept('irrecord-protocol', request.origin);

    if (busy) {
        connection.close(3013, "Server Busy. Try Again Later.");
        console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected. Server busy.');
    } else {
        console.log((new Date()) + ' Connection accepted.');
        busy = true;

        //
        /*nodeLIRC.init();
//nodeLIRC listeners
        nodeLIRC.on('stdout', function(event) {
            console.log("event -> " + event.eventName);
            console.log(event.instructions);
        });
        nodeLIRC.on('remote-config-ready', function(remoteConfig) {
            console.log(remoteConfig.name + " remote is READY.\nConfiguration file data:");
            console.log(remoteConfig.configuration);
            nodeLIRC.upsertRemote(remoteConfig.name, remoteConfig.configuration, (error) => {
                nodeLIRC.reloadData();
                nodeLIRC.send(remoteConfig.name, nodeLIRC.remotes[remoteConfig.name][0]);
            });
        });*/
//nodeLIRC listeners
        nodeLIRC.on('stdout', function(event) {
            console.log("event -> " + event.eventName);
            console.log(event.instructions);
            var response = {
                header: 'NODELIRC_STDOUT',
                status: 'OK',
                event: event
            };
            connection.sendUTF(JSON.stringify(response));
        });

        nodeLIRC.on('remote-config-ready', function(remoteConfig) {
            console.log(remoteConfig.name + " remote is READY.\nConfiguration file data:");
            console.log(remoteConfig.configuration);
            var response = {
                header: 'NODELIRC_REMOTE_CONFIG_READY',
                status: 'OK',
                remoteConfig: remoteConfig
            };
            connection.sendUTF(JSON.stringify(response));
        });

//WebSocket listeners
        connection.on('message', function(message) {
            console.log('Message received');
            /*irrecord.stdin.write(message.utf8Data + '\n');
            connection.sendUTF(message.utf8Data);*/
            //nodeLIRC.writeLine(message.utf8Data);
            console.log(message.utf8Data);
            var request = JSON.parse(message.utf8Data);

            switch (request.header) {
                case 'NODELIRC_INIT':
                    nodeLIRC.init();
                    break;
                case 'NODELIRC_RELOAD_DATA':
                    nodeLIRC.reloadData();
                    break;
                case 'NODELIRC_GET_REMOTES':
                    nodeLIRC.reloadData();
                    var response = {
                        header: 'NODELIRC_REMOTES',
                        status: 'OK',
                        remotes: nodeLIRC.getRemotes()
                    };
                    console.log(JSON.stringify(response));
                    connection.sendUTF(JSON.stringify(response));
                    break;
                case 'NODELIRC_RECORD':
                    nodeLIRC.record(request.remote);
                    break;
                case 'NODELIRC_WRITE_LINE':
                    nodeLIRC.writeLine(request.text);
                    break;
                case 'NODELIRC_UPSERT_REMOTE':
                    nodeLIRC.upsertRemote(request.remote, request.configuration, (error) => {
                        nodeLIRC.reloadData();
                        var remotes = nodeLIRC.getRemotes();
                        var remote;
                        for (var r in remotes) {
                            if (remotes[r].name == request.remote) {
                                console.log("remote found");
                                remote = remotes[r];
                            }
                        }

                        var response = {
                            header: 'NODELIRC_REMOTE_SAVED',
                            status: 'OK',
                            remote: remote
                        };
                        console.log(JSON.stringify(response));
                        connection.sendUTF(JSON.stringify(response));

                    });
                    break;
                case 'NODELIRC_SEND_REMOTE_COMMAND':
                    nodeLIRC.send(request.remote, request.code, request.duration);
                    break;
            }
        });
        connection.on('close', function(reasonCode, description) {
            busy = false;
            console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
        });

        //nodeLIRC.record('Samsung_AA59-00581A');

    }
});

