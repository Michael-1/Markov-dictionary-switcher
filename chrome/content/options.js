/* Copyright (C)2010 Freek Zindel
 * For license information please refer to the LICENSE.TXT file included in this * distribution
 */
markoswitchOptions = {
  init:function(){
    dump('\n\n');
    var Cc = Components.classes;
    var engine_classname = "@mozilla.org/spellchecker/engine;1";
    var myspell_classname = "@mozilla.org/spellchecker/myspell;1";
    var Ci = Components.interfaces;
    if(engine_classname in Cc){
      var engine = Cc[engine_classname];
    }else if(myspell_classname in Cc){
      var engine = Cc[myspell_classname];
    }else{
      alert('no spellchecker found');
    }
    this.auto = document.getElementById("autodetect");

    var dlist = {};
    engine = engine.createInstance(Ci.mozISpellCheckingEngine);
    engine.getDictionaryList(dlist, {});
    this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
      .getService(Components.interfaces.nsIPrefBranch);

    //the dictionary switcher that this plugin was based on uses this preference.
    this.auto.checked = this.prefs.getBoolPref('extensions.dictionary-switcher.autodetect');

    var pref_dicts = this.prefs.getCharPref('extensions.markoswitch.enableddicts').split(',')
    var dict_list = dlist.value.toString().split(",");
    dump(pref_dicts.length);
    self.dict_list = dict_list;
    var dl_vbox = document.getElementById("dictlist");
    this.checkboxes = [];
    for(var i = 0;i<dict_list.length;i++){
      var l = dict_list[i];
      dump("\n"+l+": ");
      dump(pref_dicts.indexOf(l));
      var cb = document.createElement('checkbox');
      cb.setAttribute('label',l);
      if(pref_dicts.indexOf(l)>=0){
	cb.setAttribute('checked',true);
      }
      dl_vbox.appendChild(cb);
      this.checkboxes[this.checkboxes.length] = cb;
    }
  },
  save:function(){
    dump('saving');
    var enabled_dicts = [];
    for(var i = 0;i<this.checkboxes.length;i++){
      if(this.checkboxes[i].checked){
	enabled_dicts[enabled_dicts.length] = this.checkboxes[i].label;
      }
    }
    this.prefs.setCharPref('extensions.markoswitch.enableddicts',enabled_dicts.join(','));
    this.prefs.setBoolPref('extensions.dictionary-switcher.autodetect',this.auto.checked);
    return true;
  }
}