/*
 * Markoswitch is based on Dictionary Switcher by Dao Gottwald.
 * However it uses another method to determine the language of a text
 * and it provides a properties dialog to select languages that you want
 * to switch between.
 *
 * the estimateLanguage,mse,getFreqs and loadEnabledDicts methods are
 * Copyright (C)2010 Freek Zindel. The other methods have been
 * written by Dao Gottwald.
 * detectDictionary is Freeks adaption of Dao's work.
 * 
 *
 *
 * dictionary switcher uses a markov chain to estimate the language
 * that a text is written in.
 * In some languages certain character combinations are more common
 * than in other languages. "sch" is common in Dutch and German,
 * but not in English.
 * The probability that a certain character will follow another is
 * different for (most) all languages. When we consider the occurance of
 * a character as a symbol that influences the likelyhood of symbols
 * that will follow we have a clasic markov chain.
 *
 * This dictionary switcher uses very short markov chains of only two symbols.
 * We only consider the likelyhood of a symbol based on the symbol
 * that came right before it.
 * In more practical terms: we take all substrings of length 2 in the text
 * that we are examining. We then measure the relative frequency of these
 * combinations of 2 characters. Since there are only 26 letters in the
 * alphabet we will have a maximum of a few hundred combinations.
 * (everything that is not a letter, such as whitespaces, will be
 * represented by a 27th symbol, thus there are 729 possible combinations)
 *
 * Once we know the combination frequencies of a text we can compare these
 * to frequencies from texts of which we know the language.
 * This program includes a file with a database of such frequencies that
 * was compiled from the wikipedia page for the "earth" lemma in every
 * available language.
 * Comparing combination frequencies is done by calculating the
 * mean squared error between one set of frequencies and another.
 * We are looking for the lowest MSE.
 * */
var dictionarySwitcher = {
  dictMenu: {},
  init: function () {
    //if we have fewer than two dicts, this switcher is useless
    if(!this.loadEnabledDicts())return;

    this.panel = document.getElementById("dictionary-switcher");

    var menu = document.getElementById("dictionary-switcher-menu");
    var menuitem = document.createElement("menuitem");
    menuitem.setAttribute("type", "radio");
    menuitem.setAttribute("name", "dictionary-switcher-dicts");
    menuitem.setAttribute("oncommand", "dictionarySwitcher.toggle(this.label)");
    for (var i = 0; i < this.list.length; i++) {
      menuitem = menuitem.cloneNode(true);
      menuitem.setAttribute("label", this.list[i]);
      this.dictMenu[this.list[i]] = menuitem;
      menu.appendChild (menuitem);
    }

    this.prefService.addObserver("spellchecker.dictionary", this, false);
    this.prefService.addObserver("extensions.dictionary-switcher.autodetect", this, false);
    this.prefService.addObserver('extensions.markoswitch.enableddicts',this,false);
    this.loadEnabledDicts();

    // XXX 1.8
    var self = this;
    this._eventListener = function (event) { self.handleEvent(event); };
    GetCurrentEditorElement().addEventListener("load", this._eventListener, true);
    GetMsgSubjectElement().addEventListener("input", this._eventListener, false);

    this.autodetect = this.prefService.getBoolPref("extensions.dictionary-switcher.autodetect");
    this.dict = this.prefService.getCharPref("spellchecker.dictionary");
    this.updateUI(false);
  },
  uninit: function () {
    this.prefService.removeObserver("spellchecker.dictionary", this);
    gMsgCompose.editor.removeEditActionListener(this);
    GetCurrentEditorElement().removeEventListener("load", this._eventListener, true);
    GetMsgSubjectElement().removeEventListener("input", this._eventListener, false);
  },
  get prefService() {
    delete this.prefService;
    return this.prefService = Components.classes["@mozilla.org/preferences-service;1"]
                                         .getService(Components.interfaces.nsIPrefBranch2);
  },
  get scCompose() {
    delete this.scCompose;
    return this.scCompose = gMsgCompose.editor.getInlineSpellChecker ?
                             gMsgCompose.editor.getInlineSpellChecker(true) :
                             gMsgCompose.editor.inlineSpellChecker;
  },
  get scSubject() {
    var editor = GetMsgSubjectElement().editor;
    delete this.scSubject;
    return this.scSubject = editor.getInlineSpellChecker ?
                             editor.getInlineSpellChecker(true) :
                             editor.inlineSpellChecker;
  },
  updateUI: function (recheck) {
    this.panel.label = this.dict;
    if (this.dictMenu._last)
      this.dictMenu._last.removeAttribute("checked");
    if (this.dictMenu._last = this.dictMenu[ this.dict ])
      this.dictMenu._last.setAttribute("checked", true);
    if (recheck) {
      this.scCompose.spellChecker.SetCurrentDictionary(this.dict);
      this.scCompose.spellCheckRange(null);
      this.scSubject.spellCheckRange(null);
    }
  },
  toggle: function (dict) {
    this.dict = dict || this.getNextInList(this.dict);
    this.updateUI(true);
    this.prefService.setCharPref("spellchecker.dictionary", this.dict);
  },
  getNextInList: function (dict) {
    var i = this.list.indexOf(dict) + 1;
    if (i >= this.list.length)
      i = 0;
    return this.list[i];
  },
  detectDictionary: function (inlineSpellChecker, text) {
    var sc = inlineSpellChecker.spellChecker;
    var dict = this.dict;
    var newDict = this.estimateLanguage(text);
    if (newDict && newDict != this.dict)
      this.toggle(newDict);
    else
      sc.SetCurrentDictionary(this.dict);
  },
  loadEnabledDicts:function(){
    var Cc = Components.classes;
    Cc["@mozilla.org/spellchecker/" + ("@mozilla.org/spellchecker/myspell;1" in Cc ? "myspell;1" : "engine;1")]
      .createInstance(mozISpellCheckingEngine)
      .getDictionaryList(this.list = {}, {});
    var lst = this.list.value.toString().split(",");
    this.list = [];
    var edp = this.prefService.getCharPref("extensions.markoswitch.enableddicts");
    if(edp){
      var enabled_dicts = edp.split(',');
      for(var i = 0;i<=lst.length;i++){
	var d = lst[i];
	if(enabled_dicts.indexOf(d)>=0){
	  this.list.push(d);
	}
      }
    }else{
      //if no dictionaries are selected assume that we want to use all dicts
      this.list = lst;
    }
    //dump('dicts = '+this.list);
    return this.list.length > 1; //only one dict? then switching doesn't make sense
  },
  /* nsIObserver */
  observe: function (subject, topic, data) {
    if (topic == "nsPref:changed") {
      switch(data) {
        case "spellchecker.dictionary":
          var dict = this.prefService.getCharPref("spellchecker.dictionary");
          if (dict != this.dict) {
            this.dict = dict;
            this.updateUI(false);
          }
          break;
        case "extensions.dictionary-switcher.autodetect":
          this.autodetect = this.prefService.getBoolPref("extensions.dictionary-switcher.autodetect");
          break;
	case "extentions.markoswitch.enableddicts":
	  this.loadEnabledDicts();
	  break;
      }
    }
  },

  /* nsIDOMEventListener */
  handleEvent: function (event) {
    switch (event.type) {
      case "input":
        if (this.autodetect) {
          var text = event.target.value;
          var l = text.length;
          if (l > 0 && l % 10 == 0){
            this.detectDictionary(this.scSubject, text);
	  }
        }
        break;
      case "load":
        gMsgCompose.editor.addEditActionListener(this);
        break;
    }
  },

  /* nsIEditActionListener */
  DidCreateNode: function(){},
  DidDeleteNode: function(){},
  DidDeleteSelection: function(){},
  DidDeleteText: function(){},
  DidInsertNode: function(){},
  DidInsertText: function(){},
  DidJoinNodes: function(){},
  DidSplitNode: function(){},
  WillCreateNode: function(){},
  WillDeleteNode: function(){},
  WillDeleteSelection: function(){},
  WillDeleteText: function(){},
  WillInsertNode: function(){},
  WillInsertText: function (textNode, offset, string) {
    if (this.autodetect) {
      var l = textNode.length;
      if (l > 0 && l % 15 == 0){
        this.detectDictionary(this.scCompose, textNode.textContent);
      }
    }
  },
  WillJoinNodes: function(){},
  WillSplitNode: function(){},
  getFreqs:function(s){
    /* return letter combination frequencies in text s */
    s = s.toLowerCase();
    var freqs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var l = s.length;
    var previous = 26;
    var a = 97;
    var z = 122;
    var c;
    var tuple_index;
    for(var i = 0;i<l;i++){
      c = s.charCodeAt(i);
      if(a<=c && c<=z){
	c-=97;
      }else{
	c = 26;
      }
      tuple_index =  previous*26 + c;
      freqs[tuple_index]++;
      previous = c;
    }
    var fl = freqs.length;
    for(var j = 0;j<fl;j++){
      freqs[j]/=l;
    }
    return freqs;
  },
  mse:function(a1,a2){
    /* return mean squared error between frequency array a1 and a2 */
    var l = a1.length;
    var error_sum = 0;
    var error;
    for(var i = 0;i<l;i++){
      error = a1[i]-a2[i];
      error_sum += error*error;
    }
    return error_sum/l;
  },
  estimateLanguage:function(s){
    var start = new Date().getTime();
    var freqs = this.getFreqs(s);
    var language_errors = [];
    var i = 0;
    for(var di = 0;di<this.list.length;di++){
      //trim nl_NL down to nl
      var dict_code = this.list[di].match("^[a-z]+")[0];
      var language_freqs = markoswitch_frequencies[dict_code];

      if(language_freqs){
	var mse = this.mse(language_freqs,freqs);
	dump('text is '+dict_code+' with error '+mse+'\n');
	language_errors[i++] = [this.list[di],mse];
      }
    }
    language_errors.sort(function(a,b){return a[1]-b[1];});
    var duration = new Date().getTime() - start;
    dump('language estimated in ms: '+duration+'\n');
    return language_errors[0][0];
  }
};
window.addEventListener("load", function () {
  dictionarySwitcher.init();
}, false);

window.addEventListener("unload", function () {
  dictionarySwitcher.uninit();
}, false);
