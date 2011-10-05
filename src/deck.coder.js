/*!
 Copyright (c) 2011 Cykod LLC
 Dual licensed under the MIT license and the GPL license
*/


/*
This module adds a code editor that shows up in individual slides
*/

var deckCoder = {
    init: function(){
        var $d = $(document),
            $window = $(window);
        
            $("a").attr('target','_blank');
            $.each($.deck('getSlides'), deckCoder.prepareSlide);
        
        
        $d.bind('deck.change',function(e,from,to) {
            var current =$.deck('getSlide', to);
            
            current.find(".coder-wrapper").each(function() {
                var $container = $(this);
                if(!$container.hasClass('coderEditor')) {
                    deckCoder.generateCodeSlide($container,current);
                }
                deckCoder.resizeEditors(current,$container);
            });
        });
        
        deckCoder.loadGists();
    },
    loadGists: function(){
        var getGists = function($gists) {
            var getGist = function(gist) {
                var $gist = $(gist),
                    gistId = $gist.attr('data-gist-id'),
                    url = 'https://api.github.com/gists/' + gistId + '?callback=?';
                if(gistId !== undefined){
                    return $.getJSON(url);
                }
            };
            return $.map($gists, getGist);
        },
        gists = $('.gist'),
        promises = getGists($('.gist'));

        $.when
            .apply(null, promises)
            .then(function() {
                var length = arguments.length;
                while(length--){
                    if(arguments[0].data !== undefined) {
                        arguments = [arguments[0]];
                    }
                    else {
                        arguments[length] = arguments[length][0];
                    }
                    
                    arguments[length].el = gists[length];
                }
                
                $.map(arguments, function(gist) {
                    var content = gist.data.files["gistfile1.txt"].content,
                        id = gist.data.id,
                        $gist = $(gist.el),
                        slide = $gist.parents('.slide'),
                        type = $gist.attr('type'),
                        classes = $gist.attr('data-gist-classes'),
                        template = $gist.attr('data-coder-template') || '',
                        language =  $gist.attr('data-language') || '',
                        save = $gist.attr('data-save') || '';
                    
                    if(type === 'text/coderdeck') {
                        $el = $('<script />')
                            .attr('id', $gist.attr('id'))
                            .attr('type', type);
                    }
                    else {
                        $el = $('<textarea />');
                    }
                    
                    $el.addClass(classes)
                        .attr('data-coder-template', template)
                        .attr('data-language', language)
                        .attr('data-save', save)
                        .text(content)
                        .find("a")
                            .attr('target','_blank')
                            .end();
                    
                    $gist.after($el).remove();
                     
                    deckCoder.prepareSlide(slide.attr('data-slide-id'), slide);
                });
                
            }, function() {
                console.log("FAIL", this, arguments);
            }
        );
    },
    unsanitize: function(str) {
        return deckCoder.addScript(str).replace(/&lt;/g,'<').replace(/&gt;/g,'>');
    },
    addScript: function(str) {
        return str.replace(/SCRIPTEND/,'</s' + 'cript>').replace(/SCRIPT/g,'<script>')
    },
    runCode: function(element,template) {
        iframe = document.createElement("IFRAME"); 
        iframe.style.width = ($(element).parent().width()-2) + "px";
        iframe.style.height = ($(element).parent().height()-2) + "px";
        iframe.style.overflow = 'auto';
        iframe.style.border ="none";
        
        var dest = $(element).attr('data-target');
        var destination = $("#" + dest );
        $(destination).html("").append(iframe);
        
        
        var editor = $(element).data('editor');
        var code = editor.getValue();
        
        if($(element).attr('data-save')) {
            localStorage[$(element).attr('data-save')] = code;
        }
        
        var tmpl = $(template ? "#" + template : "#coderdeck-default").html();
        
        code = "<!DOCTYPE HTML>" + deckCoder.addScript(tmpl).replace(/CODE/,code);
        
        deckCoder.writeIFrame(iframe,code);
    },
    writeIFrame: function(iframe,code) {
        iframe = (iframe.contentWindow) ? iframe.contentWindow : (iframe.contentDocument.document) ? iframe.contentDocument.document : iframe.contentDocument;
        iframe.document.open();
        iframe.document.write(code);
        iframe.document.close();
    },
    // Prepare a slide to give unique id to code editor, create run destinations
    // and match code editors with solutions and destinations
    prepareSlide: function(idx,$el) {
        var slide = $($el);
            $element =slide.find(".coder-editor"); 
            solution = slide.find("script[type=coder-solution]")[0],
            codeEditor = slide.find(".coder-editor"),
            config = {
                isFull:     $element.hasClass("coder-editor-full"),
                isInstant:  $element.hasClass('coder-editor-instant'), 
                isSolution: !!solution,
                isSaving:   $element.attr('data-save'),
                language:   $element.attr('data-language')
            },
            fullClass = config.isFull ? " coder-wrapper-full" : " coder-wrapper-split";
            
        slide.attr('data-slide-id', idx);
        codeEditor.attr({
            'id': 'editor-' + idx,
            'data-target' : 'destination-' + idx
        }).wrapAll("<div class='coder-wrapper" + fullClass + "'><div class='coder-editor-wrapper' id='wrapper-" + idx + "'></div></div>").css('position','static');
    
    
        $("<div class='coder-destination' id='destination-" + idx + "'></div>").insertAfter("#wrapper-"+idx);
        if(solution) {
            $(solution).attr({ 'id' : 'solution-' + idx });
            slide.find(".coder-editor").attr({ 'data-solution' : 'solution-' + idx });
        }
        
        $element.data("config", config);
    },
    loadFromLocalStorage: function($element,config) {
        if(localStorage[$element.attr('data-save')]) {
            config.html = localStorage[$element.attr('data-save')];
        }
    },
    setupCodeEditor: function(currentSlide,$container,$element,$destination,config) {
        var editorOptions = { 
            lineNumbers: true,
            onFocus: function() { editorFocused = true; },
            onBlur: function() { editorFocused = false; },
            mode: config.language || "htmlmixed"
        };
        
        if(config.isInstant) {
            $destination.show();
            var changeTimer = null;
            editorOptions.onChange =  function() { 
                clearTimeout(changeTimer);
                changeTimer = setTimeout(function() {
                    deckCoder.runCode($element,$element.attr('data-coder-template'));
                }, 50);
            };
        
        }
        var editor = CodeMirror.fromTextArea($element[0], editorOptions );
        
        $element.data('editor',editor);
        $(editor.getScrollerElement()).height($(currentSlide).height() - $container.position().top - 80);
        $container.addClass('coderEditor');
        $destination.height($(currentSlide).height() - $container.position().top - 80);
        editor.setValue(config.html);
        return editor;
    },
    createBackbutton: function($wrapper,callback) {
        return $("<button>Back</button>").insertBefore($wrapper).click(callback).hide();
    },
    createSolution: function($wrapper,callback) {
        return $("<button>Solution</button>").insertBefore($wrapper).click(callback);
    },
    createRunButton: function(config,$wrapper,callback) {
        var buttonName = config.isSaving ? "Run/Save" : "Run";
        return $("<button>" + buttonName + "</button>").insertBefore($wrapper).click(callback);
    },
    resizeEditors: function(currentSlide,$container) {
        var $element = $container.find('.coder-editor');
        var $destination = $("#" + $element.attr('data-target'));
        
        var editor = $element.data("editor");
        var height = $(currentSlide).height() - $container.position().top - 80;
        $(editor.getScrollerElement()).height(height);
        $destination.height(height);
    },
    
    generateCodeSlide: function($container,currentSlide) { 
        var $element = $container.find('.coder-editor');
        var $wrapper = $container.find('.coder-editor-wrapper');
        var $destination = $("#" + $element.attr('data-target'));
        
        var config = $element.data("config");
        config.html = deckCoder.unsanitize($element.html());
        
        if(config.isSaving) { deckCoder.loadFromLocalStorage($element,config); }
        
        $element.css('visibility','visible');
        
        var editor = deckCoder.setupCodeEditor(currentSlide,$container,$element,$destination,config);
        
        var $backButton = null;
        
        if(!config.isInstant) {
            deckCoder.createRunButton(config,$wrapper, function() {
                if(config.isFull) {  
                    $backButton.show();
                    $wrapper.hide();
                }
                $destination.show();
                deckCoder.runCode($element,$element.attr('data-coder-template'));
            });
        }
        
        if(config.isFull) { 
            $backButton = deckCoder.createBackbutton($wrapper,function() {
                $destination.toggle();
                $wrapper.toggle();
            });
        }
        
        if(config.isSolution) {
            deckCoder.createSolution($wrapper,function() {
                var solution = $element.attr('data-solution');
                editor.setValue(deckCoder.unsanitize($("#" + solution).html()));
            });
        }
    }
};

$(document).bind('deck.init',function() {
    deckCoder.init();
});
