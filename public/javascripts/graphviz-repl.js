var compiling = false;
var needCompile = true;

var roomNavigator = {
  goToRoom: function (_this) {
    var roomName = $(_this).find('input').val();
    window.location = "/" + roomName;
    return false;
  },
  goToRandom: function () {
    window.location = "/" + this.randomPadName();
  },
  randomPadName: function () {
    var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    var string_length = 10;
    var randomstring = '';
    for (var i = 0; i < string_length; i++)
    {
      var rnum = Math.floor(Math.random() * chars.length);
      randomstring += chars.substring(rnum, rnum + 1);
    }
    return randomstring;
  }
};

var etherpadWhisperer = {
  settings: {
    exportSuffix: '/export/txt',
    importSuffix: '/import',
    hostRoot: 'https://pad.systemli.org/p/'
  },

  txtImportPath: function (padName) {
    return this.settings.hostRoot + padName + this.settings.importSuffix;
  },

  txtExportPath: function (padName) {
    return this.settings.hostRoot + padName + this.settings.exportSuffix;
  },

  txtImportToPad: function (padName, data) {
    var url = this.txtImportPath(padName);
    $.ajax(
      {
        url: url,
        type: "post",
        processData: false,
        async: false,
        contentType: 'multipart/form-data; boundary=boundary',
        accepts: {
          text: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        data: 'Content-Type: multipart/form-data; boundary=--boundary\r\n\r\n--boundary\r\nContent-Disposition: form-data; name="file"; filename="import.txt"\r\nContent-Type: text/plain\r\n\r\n' + data + '\r\n\r\n--boundary'
      }
    );
  },

  txtImportFromUrl: function (padName, source_url) {
    $.get(source_url).success(function(data){
      this.txtImportToPad(padName, data);
    });
  },

  tutorials: [
    {'name': 'Table of Contents'     , 'url': 'https://gist.githubusercontent.com/caseywatts/78e1577fab56d04df8cd/raw/ac81e58f707e7121d76c49b2782baad67645a4d2/0tableOfContents.dot'},
    {'name': '1 Simplest Diagrams'   , 'url': 'https://gist.githubusercontent.com/caseywatts/78e1577fab56d04df8cd/raw/ac81e58f707e7121d76c49b2782baad67645a4d2/1simplestDiagrams.dot'},
    {'name': '2 Advanced Attributes' , 'url': 'https://gist.githubusercontent.com/caseywatts/78e1577fab56d04df8cd/raw/ac81e58f707e7121d76c49b2782baad67645a4d2/2advancedAttributes.dot'},
    {'name': '3 With Subgraphs'      , 'url': 'https://gist.githubusercontent.com/caseywatts/78e1577fab56d04df8cd/raw/ac81e58f707e7121d76c49b2782baad67645a4d2/3withSubgraphs.dot'},
  ],

  importTutorial: function (number) {
    var etherpadId = $('iframe').data('etherpad-id');
    this.txtImportFromUrl(etherpadId, this.tutorials[number].url);
  }
};

var userInterfaceInteractor = {
  type: 'dot',
  error: function (text){
    var errArea = $('#msg');
    if(text){
      errArea.text(text);
      errArea.fadeIn();
    }else{
      errArea.fadeOut();
    }
  },
  setType: function (selected){
    this.type = $(selected).attr('type');
    var items = $(selected).parent().parent().children();
    items.each(function(e){
      $($($(items[e]).children()[0]).children()[0]).text('　');
    });
    $($(selected).children()[0]).text('✓');
    needCompile = true;
  },
  getType: function (){
    return this.type;
  }
};

var graphRenderer = {
  successCallback: function(data, textStatus, jqXHR){
    compiling = false;
    $('#graph').attr('src',data);
    userInterfaceInteractor.error();
    if(cb){
      cb();
    }
  },
  errorCallback: function(jqXHR, textStatus, errorThrown){
    compiling = false;
    if(jqXHR.status == 400){
      userInterfaceInteractor.error(jqXHR.responseText);
      $('#graph').attr('src','/no_such_path');
    }
    if(cb){
      cb();
    }
  },
  compile: function (dotData, type, cb){
    if(compiling){
      return;
    }
    compiling = true;
    $.ajax({
      type: 'POST',
      url: '/compile.b64',
      data: {
        dot: dotData,
        type: type
      }
    })
    .done(this.successCallback)
    .fail(this.errorCallback);
  },
  autoCompileDo: function (){
    var etherpadId = $('iframe').data('etherpad-id');
    $.get(etherpadWhisperer.txtExportPath(etherpadId), function( data ) {
      var _newDotData = data;
      var _cachedDotData = cacheWhisperer.loadCachedDotData(etherpadId);
      if(_cachedDotData === null){
        // if cache is empty, use server data
        needCompile = true;
        cacheWhisperer.cacheDotData(etherpadId, _newDotData);
      }
      else if(_cachedDotData !== _newDotData){
        // if this server data hasn't been rendered yet
        needCompile = true;
        cacheWhisperer.cacheDotData(etherpadId, _newDotData);
      }

      if(!needCompile){
        return;
      }
      graphRenderer.compile(_newDotData,
                            userInterfaceInteractor.getType(),
                            function(){
                              needCompile = false;
                            });
    });
  },
};

var cacheWhisperer = {
  defaultData: function () {
    return ['digraph noname {',
      '   node[shape=box]',
      '   graph[nodesep=2, ranksep=2]',
      '   graphviz_repl [label="Graphviz-REPL"]',
      '   you[label="You", shape=circle]',
      '   graphviz_repl -> you[label="welcome"]',
      '   {rank=same; graphviz_repl; you}',
      '}'].join("\n");
  },
  loadCachedDotData: function (etherpadId) {
    var _cachedData = localStorage.getItem(etherpadId);
    if (_cachedData !== null && _cachedData.trim() !== "")
      return _cachedData;
    else
      return null;
  },
  cacheDotData: function (etherpadId, data) {
    localStorage.setItem(etherpadId, data);
  }
};

var svgToPngConverter = {
  // Takes an SVG element as target
  svg_to_png_data: function (target) {
    var ctx, mycanvas, svg_data, img, child;

    // Construct an SVG image
    var new_width = target.width.baseVal.valueInSpecifiedUnits;
    var new_height = target.height.baseVal.valueInSpecifiedUnits;

    svg_data = '<svg xmlns="http://www.w3.org/2000/svg" width="' + new_width +
    '" height="' + new_height + '">' + target.innerHTML + '</svg>';
    img = new Image();
    img.src = "data:image/svg+xml;utf8," + svg_data;

    // Draw the SVG image to a canvas
    mycanvas = document.createElement('canvas');
    mycanvas.width = new_width;
    mycanvas.height = new_height;
    ctx = mycanvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    // Return the canvas's data
    return mycanvas.toDataURL("image/png");
  },
  // Takes an SVG element as target
  svg_to_png_replace: function (target) {
    var data, img;
    data = this.svg_to_png_data(target);
    img = new Image();
    img.src = data;
    target.parentNode.replaceChild(img, target);
  }
};

$(document).ready(function(){
  graphRenderer.autoCompileDo();
  setInterval(graphRenderer.autoCompileDo, 500);
});
