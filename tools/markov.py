# Copyright (C)2010 Freek Zindel
# For license information please refer to the LICENSE.TXT file included in this distribution
#
# This program generates relative letter combination frequencies for the wikipedia "Earth" lemma in all available languages. These known frequencies are later compared to other texts to determine the language. 
#
import urllib2
import sys
opener = urllib2.build_opener()
opener.addheaders = [('User-agent', 'Mozilla/5.0')]
earth_url = "http://en.wikipedia.org/wiki/Earth"
wikipedia_startpage = opener.open(earth_url).read()
from xml.dom.minidom import parseString
starttree = parseString(wikipedia_startpage)
html = starttree.getElementsByTagName('html')[0]
language_portlet = [div for div in html.getElementsByTagName('div') if div.getAttribute('id')=='p-lang'][0]
other_languages = language_portlet.getElementsByTagName('a')
language_urls = [l.getAttribute('href') for l in other_languages]
import traceback
import cjson

def getFreqs(s):
    l = float(len(s))
    freqs = [0.0]*27*27
    for t in getTuples(s):
        freqs[getPosition(t)]+=1.0
    return [f/l for f in freqs]

def getText(nodelist):
    for node in nodelist:
        if node.nodeType == node.TEXT_NODE:
            yield node.data

def getLanguage(tree):
    html = tree.getElementsByTagName('html')[0]
    paragraphs = html.getElementsByTagName('p')
    text = []
    for p in paragraphs:
        text+=getText(p.childNodes)
    lang = html.getAttribute('lang')
    return lang,' '.join(text)


def getMarkov(url):
    sys.stderr.write("working on: %s\n"%url)
    try:
        data = opener.open(url).read()
        tree = parseString(data)
        language_code,text = getLanguage(tree)
        freqs = getFreqs(text)
        return language_code,freqs
    except:
        traceback.print_exc()
        return 'ignore',None

all_urls = ["http://en.wikipedia.org/wiki/Earth"]+language_urls
markovs = dict(getMarkov(u) for u in all_urls)
del markovs['ignore']
sys.stdout.write("markoswitch_frequencies="+cjson.encode(markovs)+"\n")








