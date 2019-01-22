/* Copyright 2019 Jonathan (Jon) DuBois */

/* Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: */

/* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. */

/* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. */

// All globals are in lnz.
var lnz;


// All code lives in this.
window.addEventListener( "load", function(){
	var dbg = false;
	var dbgframebuffer = false;
	var dbgtexture = false;
	var showfps = false;
	dbg = true;
	//dbgframebuffer = true;
	//dbgtexture = true;
	showfps = true;

	var mousex;
	var mousey;
	var mousew;
	var moused = [ 0, 0 ];
	var mbuttons = 0;
	var mouseclicks = 0;
	var mousereleases = 0;
	window.addEventListener( "mousemove", function( me ){
		mousex = me.clientX;
		mousey = me.clientY;
	});
	window.addEventListener( "mousemove", function( me ){
		mousex = me.clientX;
		mousey = me.clientY;
	});
	
	window.addEventListener( "mousedown", function( me ){
		mbuttons = me.buttons
		me.preventDefault();
		me.stopPropagation();
		return false;
	}, true);
	window.addEventListener( "mouseup", function( me ){
		mbuttons = me.buttons
		me.preventDefault();
		return false;
	}, true);
	window.addEventListener( "contextmenu", function( me ){
		me.preventDefault();
		return false;
	}, true);
	
	
	
	// This is set up and then exported to lnz at the end.
  var exp = new Object();
	// Constants
	exp.defaultWidth = 256;
	exp.defaultHeight = 256;
	
	// The global rendering context. These get set in init.
	var canvas;
	var gl;
	// Easily expanded state goes here. Idealy adding new functions should
	// invlolve modifying only this.
	var machine = new Object();
	// Global texure store.
	var textures = new Object();
	// This is the global list of machines.
	var machines = new Array();
	
	var anisotropyExt;
			

	// This is the machine that gets created per canvas.
	class Machine{
		constructor( sname, gl, ctx, verts, srcs, oldvals, cnvs, _globals ){
			try{

				if( !srcs || srcs.length === 0 ){
					error( "No sources defined." );
				}
				this.name = sname;
				this.canvas = cnvs;
				this.width = cnvs.width;
				this.height = cnvs.height;
				this.oldvalues = oldvals;
				this.setsColor = false;
				this.framebuffer = new Object();
				this.framebuffer.attachments = new Object();
				this.framebuffer.fb = gl.createFramebuffer();
				this.triggered = new Set();
				this.vertices = verts;
				this._thunks = new Array();
				this._uniforms = new Object();
				this._uniformTypes = new Object();
				this.gl = gl;
				this.ctx = ctx;
				this.sources = new Array();
				this._syntaxArrays = new Array();
				
				for( var s = 0; s < srcs.length; ++s ){
					if( srcs[ s ][ 0 ] == "Color" ){
						this.setsColor = true;
					}
					{
						var t = srcs[ s ][ 1 ].replace( /\s/g, " " );
						var q = 1;
						while( t !== q ){
							q = t;
							t = t.replace( /\s\s/g, " " );
						}
						t = t.replace( / ?([,\[\]\(\)]) ?/g, "$1" );
						this.sources.push( [ srcs[ s ][ 0 ], t ] );
					}
					// What actually gets parsed has no whitespace other than single
					// spaces.
					this._syntaxArrays.push( [ this.sources[ s ][ 0 ],
																		 this._parse( this.sources[ s ][ 1 ] ) ]
																 ); 
					// Handle textures.
					if( this._syntaxArrays[ s ][ 0 ][ 0 ] == "*" ){
						var m = this._syntaxArrays[ s ][ 0 ];
						var n = m.substring( 1 );
						if( n[ 0 ] == "#" ){
							n = n.substring( 1 );
						}
						machine.names[ m ] = new Object();
						machine.names[ m ].name = n;
						machine.names[ m ].type = function( type ){
							if( Number.parseInt( type.substring( 0, 1 ) ) > 4 ){
								var ans = new Object;
								ans.error = "Cannot store matrices in a texture:";
								return ans;
							}
							if( type.substring( 2, 3 ) != "f" ){
								var ans = new Object;
								ans.error = "Textures must be set to a fragment variable "
								+ "value:";
								return ans;
							}
							return type;
						}
					}
				}
				for( var i = 0; i < this._syntaxArrays.length; ++i ){
					this._type( this.sources[ i ][ 1 ], this._syntaxArrays[ i ] );
					if( this._syntaxArrays[ i ][ 0 ][ 0 ] == "@" ){
						this._syntaxArrays[ i ][ 1 ][ 0 ] =
							this._syntaxArrays[ i ][ 1 ][ 0 ].substring( 0, 3 ) + "a";
					}else if( machine.names[ this._syntaxArrays[ i ][ 0 ] ] ){
						var ret = machine.names[ this._syntaxArrays[ i ][ 0 ] ]
								.type( this._syntaxArrays[ i ][ 1 ][ 0 ].substring( 1, 4 ) );
						if( ret.error ){
							errorAtPlace( this.sources[ i ][ 1 ], 0, ret.error );
						}
						// Handle textures.
						var name = this._syntaxArrays[ i ][ 0 ];
						if( name[ 0 ] == "*" ){

							var tex = gl.createTexture();
							textures[ name ].format = gl.RGBA;
							textures[ name ].width = this.canvas.width;
							textures[ name ].height = this.canvas.height;
							textures[ name ].ttype = gl.TEXTURE_2D;
							textures[ name ].internalFormat = gl.UNSIGNED_BYTE;
							textures[ name ].filter = gl.LINEAR_MIPMAP_LINEAR;
							textures[ name ].tex = tex;
							if( dbg ){ info( "Creating and binding rtt." ); }
					
							gl.bindTexture( gl.TEXTURE_2D, tex );
							gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,
																gl.CLAMP_TO_EDGE );
							gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,
																gl.CLAMP_TO_EDGE );
							if( name[ 1 ] == "#" ){
								gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA,
															 this.canvas.width,
															 this.canvas.height, 0, gl.RGBA,
															 gl.UNSIGNED_BYTE, null );
								textures[ name ].remipmap = true;
								if( anisotropyExt ){
										var max =
												gl.getParameter(
													anisotropyExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT );
									gl.texParameterf( gl.TEXTURE_2D,
																		anisotropyExt.TEXTURE_MAX_ANISOTROPY_EXT
																		, max );
									textures[ name ].internalFormat = max;
								}else{
									textures[ name ].filter = gl.LINEAR_MIPMAP_LINEAR;
									gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER,
																		gl.LINEAR );
									gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
																		gl.LINEAR_MIPMAP_LINEAR );
								}
							}else{
								textures[ name ].internalFormat = gl.FLOAT;
								textures[ name ].filter = gl.NEAREST;
								textures[ name ].firstFormat = gl.RGBA32F;
								gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA32F,
															 this.canvas.width,
															 this.canvas.height, 0, gl.RGBA,
															 gl.FLOAT, null );
								gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER,
																	gl.NEAREST );
								gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
																	gl.NEAREST );
							}
							gl.bindTexture( gl.TEXTURE_2D, null );

							if( this.textureAttachments == undefined ){
								this.textureAttachments = 1;
							}else{
								this.textureAttachments += 1;
							}
							if( this.writeTo === undefined ){
								this.writeTo = new Object();
							}
							this.writeTo[ name ] = true;
							gl.bindFramebuffer( gl.FRAMEBUFFER, this.framebuffer.fb );
							var gla = gl[ "COLOR_ATTACHMENT" + this.textureAttachments ];
							this.framebuffer.attachments[ name ] = gla;
							gl.framebufferTexture2D( gl.FRAMEBUFFER,
																			 gla,
																			 gl.TEXTURE_2D, textures[ name ].tex,
																			 0 );
							var db = new Array();
							for( var l = 0; l <= this.textureAttachments; ++l ){
								db.push( gl[ "COLOR_ATTACHMENT" + l ] );
							}
							gl.drawBuffers( db );
							gl.bindFramebuffer( gl.FRAMEBUFFER, null );
						}
						this._syntaxArrays[ i ][ 1 ][ 0 ] =
							this._syntaxArrays[ i ][ 1 ][ 0 ].substring( 0, 1 ) + ret;

					}

				}
				if( dbg ){ info( "syntax array = "
												 + JSON.stringify( this._syntaxArrays ) ); }
				var shaders = new Object();
				shaders.header = "";
				shaders.fragmentHeader = "";
				shaders.vertexHeader = "";
				shaders.fragmentFooter = "";
				shaders.vertexFooter = "";

				for( var i = 0; i < this._syntaxArrays.length; ++i ){
					shaders = this._eval( shaders, this._syntaxArrays[ i ][ 0 ],
																this._syntaxArrays[ i ][ 1 ] );
					if( this._syntaxArrays[ i ][ 1 ][ 0 ].value instanceof Function
							&& !this._syntaxArrays[ i ][ 1 ][ 0 ].value.numargs ){
						let oldfunc = this._syntaxArrays[ i ][ 1 ][ 0 ].value;
						let name = this._syntaxArrays[ i ][ 0 ];
						let thisp = this;
						let newfunc = function(){
							if( thisp.curvalues ){
								if( thisp.curvalues[ name ] ){
									return thisp.curvalues[ name ];
								}else{
									var ans = oldfunc();
									thisp.curvalues[ name ] = ans;
									return ans;
								}
							}else{
								machine.log += "\n\n\noldfuncing   " + name + "\n\n";
								return oldfunc();
							}
						}
						thisp._syntaxArrays[ i ][ 1 ][ 0 ].value = newfunc;
					}
				}

				// Create color texture.
				if( this.setsColor && this.textureAttachments > 0 ){
					this.colorTexture = new Object();
					this.colorTexture.tex = gl.createTexture();
					this.colorTexture.format = gl.RGBA;
					this.colorTexture.width = this.canvas.width;
					this.colorTexture.height = this.canvas.height;
					this.colorTexture.ttype = gl.TEXTURE_2D;
					this.colorTexture.internalFormat = gl.UNSIGNED_BYTE;
					this.colorTexture.filter = gl.LINEAR;
					
					if( dbg ){ info( "Creating and binding color buffer." ); }
					gl.bindTexture( this.colorTexture.ttype, this.colorTexture.tex );
					gl.texImage2D( this.colorTexture.ttype, 0,
												 this.colorTexture.format,
												 this.colorTexture.width,
												 this.colorTexture.height, 0,
												 this.colorTexture.format,
												 this.colorTexture.internalFormat, null );
					gl.texParameteri( this.colorTexture.ttype, gl.TEXTURE_MAG_FILTER,
													this.colorTexture.filter );
					gl.texParameteri( this.colorTexture.ttype, gl.TEXTURE_MIN_FILTER,
														this.colorTexture.filter );
					gl.texParameteri( this.colorTexture.ttype, gl.TEXTURE_WRAP_S,
														gl.CLAMP_TO_EDGE );
					gl.texParameteri( this.colorTexture.ttype, gl.TEXTURE_WRAP_T,
														gl.CLAMP_TO_EDGE );
					gl.bindFramebuffer( gl.FRAMEBUFFER, this.framebuffer.fb );
					gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
																	 this.colorTexture.ttype,
																	 this.colorTexture.tex, 0 );
					gl.bindTexture( this.colorTexture.ttype, null );
					gl.bindFramebuffer( gl.FRAMEBUFFER, null );
			
				}
				


				machine.genShaders( shaders, this );

				// Check if we need double buffering.
				var addfbo = false;
				if( this.writeTo ){
					for( var elem in this.writeTo ){
						if( this.readFrom && this.readFrom[ elem ] ){

							addfbo = true;
							var tex = textures[ elem ];
							textures[ elem ].tex2 = gl.createTexture();
							var mag = tex.filter;
							if( mag == gl.LINEAR_MIPMAP_LINEAR ){
								mag = gl.LINEAR;
							}
							if( dbg ){ info( "Creating and binding double buffer." ); }
							gl.bindTexture( tex.ttype, tex.tex2 );
							gl.texImage2D( tex.ttype, 0, tex.firstFormat, tex.width,
														 tex.height,
														 0, tex.format, tex.internalFormat, null );
							gl.texParameteri( tex.ttype, gl.TEXTURE_WRAP_S,
																gl.CLAMP_TO_EDGE );
							gl.texParameteri( tex.ttype, gl.TEXTURE_WRAP_T,
																gl.CLAMP_TO_EDGE );
							if( tex.filter instanceof Number ){
								gl.texParameterf( gl.TEXTURE_2D,
																	anisotropyExt.TEXTURE_MAX_ANISOTROPY_EXT,
																	tex.filter );
							}else{
								gl.texParameteri( tex.ttype, gl.TEXTURE_MAG_FILTER,
																	mag );
								gl.texParameteri( tex.ttype, gl.TEXTURE_MIN_FILTER,
																	tex.filter );
								gl.bindTexture( tex.ttype, null );
							}
							
							var nm = elem.replace( /^ *\*#?(.*)$/, "$1" );
							var ns = shaders.fragment.replace(
								new RegExp( "(;\nlayout\\( location =[^;]+)" + nm + ";\n" ),
								"$1DoubleBuffer" + nm + ";\n" );
							ns = ns.replace(
								new RegExp( ";\n" + nm + " = " ), ";\nDoubleBuffer"
									+ nm + " = " ); 
							shaders.fragment = ns;
						}
					}
				}

				// Create secondary fbo if it doesn't exist. Add elen=tex2, make flip
				// so it tex is always the current value.
				if( addfbo ){
					this.framebuffer.fb2 = gl.createFramebuffer();
					gl.bindFramebuffer( gl.FRAMEBUFFER, this.framebuffer.fb2 );
					for( var elem in this.framebuffer.attachments ){
						var at = textures[ elem ].tex;
						if( textures[ elem ].tex2 ){
							at = textures[ elem ].tex2;
						}
						gl.framebufferTexture2D( gl.FRAMEBUFFER,
																		 this.framebuffer.attachments[ elem ],
																		 gl.TEXTURE_2D, at, 0 )
					}
					if( this.colorTexture ){
						gl.framebufferTexture2D( gl.FRAMEBUFFER,
																		 gl.COLOR_ATTACHMENT0,
																		 gl.TEXTURE_2D,
																		 this.colorTexture.tex, 0 );
					}
					var db = new Array();
					for( var l = 0; l <= this.textureAttachments; ++l ){
						db.push( gl[ "COLOR_ATTACHMENT" + l ] );
					}
					gl.drawBuffers( db );
					gl.bindFramebuffer( gl.FRAMEBUFFER, null );
				}

				// Export globals.
				if( Object.keys( _globals ).length ){
					if( !this.name ){
						error( "Attempt to export global in unnamed script." );
					}
					for( let el in _globals ){
						var ename = this.name + el;
						if( machine.globals[ ename ] ){
							error( "Attempt to export " + ename + " twice" );
						}
						var etype = this.getType( el.substring( 1 ) );
						if( etype.substring( 2, 3 ) != "u"
								&& etype.substring( 2, 3 ) != "c" ){
							error( "Attempt to export GPU variable." );
						}
						var evalue = this.getValue( el.substring( 1 ) );
						
						machine.globals[ ename ] = new Object();
						machine.globals[ ename ].value = evalue;
						machine.globals[ ename ].type = etype;
					}
				}

				if( dbg ){ info( shaders.vertex ); }
				if( dbg ){ info( shaders.fragment ); }

				// Compile;
				this._compile( shaders );
				// Delete framebuffer if not used.
				if( !this.textureAttachments || this.textureAttachments == 0 ){
					gl.deleteFramebuffer( this.framebuffer.fb );
					delete this.framebuffer.fb;
				}
				// Add thunks for oldvalues.
				for( let el in this.oldvalues ){
					var thisp = this;
					machine.postThunks.push( function(){						
						thisp.oldvalues[ el ].val = thisp.getValue( el )();
					});
				}				

			} catch( str ){
				if( str.error ){
					error( str.error );
				} else{
					throw str;
				}
			}
		}
		queryTexture(){
			var ans = "";
			var pnames = [
				"TEXTURE_MIN_FILTER",
				"TEXTURE_MAG_FILTER",
				"TEXTURE_WRAP_S",
				"TEXTURE_WRAP_T",
			];
			if( anisotropyExt ){
				pnames.push( "TEXTURE_MAX_ANISOTROPY_EXT" );
			}
			
			for( var pn in pnames ){
				var val;
				if( pnames[ pn ] == "TEXTURE_MAX_ANISOTROPY_EXT" ){
					val = anisotropyExt[ pnames[ pn ] ];
				}else{
					val = gl[ pnames[ pn ] ];
				}
				var qu = gl.getTexParameter( gl.TEXTURE_2D, val );
				var qu2 = undefined;
				for( var el in gl ){
					if( ( pnames[ pn ] != "TEXTURE_MAX_ANISOTROPY_EXT" ) &&
							gl[ el ] == qu ){
						qu2 = el;
					}
				}
				if( qu2 == undefined ){

					qu2 = qu;
				}
				ans += pnames[ pn ] + ": " + qu2 + "\n";
				
			}
			return ans;
		}
		queryFramebuffer(){
			var ans = "";
			var targets = [ "DRAW_FRAMEBUFFER", "READ_FRAMEBUFFER" ];
			var attachments = [
				"COLOR_ATTACHMENT0", "COLOR_ATTACHMENT1", "COLOR_ATTACHMENT2",
				"COLOR_ATTACHMENT3", "COLOR_ATTACHMENT4", "COLOR_ATTACHMENT5",
				"COLOR_ATTACHMENT6", "COLOR_ATTACHMENT7", "DEPTH_ATTACHMENT",
				"STENCIL_ATTACHMENT", "DEPTH_STENCIL_ATTACHMENT"
			];
			var pnames = [
				"FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE",
				"FRAMEBUFFER_ATTACHMENT_OBJECT_NAME",
				"FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL",
				"FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE",
				"FRAMEBUFFER_ATTACHMENT_BLUE_SIZE",
				"FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING",
				"FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE",
				"FRAMEBUFFER_ATTACHMENT_DEPTH_SIZE",
				"FRAMEBUFFER_ATTACHMENT_GREEN_SIZE",
				"FRAMEBUFFER_ATTACHMENT_RED_SIZE",
				"FRAMEBUFFER_ATTACHMENT_STENCIL_SIZE",
				"FRAMEBUFFER_ATTACHMENT_TEXTURE_LAYER"
			];
			ans += "Number of texture attachments: " + this.textureAttachments
				+ "\n";
			for( var at in attachments ){
				var qus = new Array();
				for( var ta in targets ){
					qus.push( new Array() );
					for( var pn in pnames ){						
						var qu = gl.getFramebufferAttachmentParameter(
							gl[ targets[ ta ] ], gl[ attachments[ at ] ],
							gl[ pnames[ pn ] ] );
						if( pn == 0 && qu == 0){
							break;
						}
						if( pn == 1 ){
							for( var tx in textures ){
								if( textures[ tx ].tex == qu ){
									qu = tx;
								}
								if( this.colorTexture == qu ){
									qu = "colorTexture";
								}
							}
						}
						qus[ qus.length - 1 ].push( attachments[ at ] + " "
																				+ pnames[ pn ] + ": " + qu );
					}
				}
				for( var ele in qus[ 0 ] ){
					if( qus[ 0 ][ ele ] == qus[ 1 ][ ele ] ){
						ans += "FRAMEBUFFER " + qus[ 0 ][ ele ] + "\n";
					}else{
						ans += "DRAW_FRAMEBUFFER " + qus[ 0 ][ ele ] + "\n";
					}
				}
				for( var ele in qus[ 0 ] ){
					if( qus[ 0 ][ ele ] != qus[ 1 ][ ele ] ){
						ans += "READ_FRAMEBUFFER " + qus[ 0 ][ ele ] + "\n";
					}
				}
			}
			return ans;
		}
		think(){
			this._thunks.forEach( function( e ){
				e();
			});
		}
		
		setFramebuffer(){
			
			gl.useProgram( this.program );

			if( this.textureAttachments ){
				if( this.framebuffer.fb2 ){ 
					var tmp = this.framebuffer.fb;
					this.framebuffer.fb = this.framebuffer.fb2;
					this.framebuffer.fb2 = tmp;
					if( dbg ){ machine.log += "Swapping framebuffer.\n"; }
				}
				gl.bindFramebuffer( gl.FRAMEBUFFER, this.framebuffer.fb );
				if( dbgframebuffer ){
					machine.log += this.queryFramebuffer();
				}else if( dbg ){
					machine.log += "Bound a framebuffer.\n";
				}
			}else{
				gl.bindFramebuffer( gl.FRAMEBUFFER, null );
				if( dbg ){
					machine.log += "Bound null framebuffer.\n";
				}
			}
		}
		setUniforms(){
			var thisp = this;
			var samplerIndex = 0;
			Object.keys( this._uniformTypes ).forEach( function( e ){
				var el = thisp._uniforms[ e ];
				if( thisp._uniformTypes[ e ] == "s" ){
					var f = e.substring( 1 );
					if( f[ 0 ] == "#" ){
						f = f.substring( 1 );
					}
					//info( f + " " + samplerIndex );
					gl.activeTexture( gl[ "TEXTURE" + samplerIndex.toString() ] );
					if( dbg ){
						machine.log += "Binding " + e + " on texture unit " +
							samplerIndex.toString() + "\n";
						machine.log += "Dimensions " + textures[ e ].width
							+ "x" + textures[ e ].height + "\n";
					}
					if( !thisp.framebuffer.attachments[ e ] ){
						if( textures[ e ].flip ){
							gl.bindTexture( gl.TEXTURE_2D, textures[ e ].tex2 );
						}else{
							gl.bindTexture( gl.TEXTURE_2D, textures[ e ].tex );
						}
					}else{
						if( dbg ){ machine.log += "Swapping " + e + "\n"; }
						if( !textures[ e ].flip ){
							gl.bindTexture( gl.TEXTURE_2D, textures[ e ].tex );
							textures[ e ].flip = true;
						}else{
							gl.bindTexture( gl.TEXTURE_2D, textures[ e ].tex2 );
							textures[ e ].flip = false;							
						}
					}
					gl.uniform1i( gl.getUniformLocation( thisp.program, f ),
												samplerIndex );
					if( dbgtexture ){ machine.log += thisp.queryTexture(); }
					if( textures[ e ].remipmap ){
						if( dbg ){
							machine.log += "Remipmaping\n";
						}
						thisp.gl.generateMipmap( gl.TEXTURE_2D );
					}
					samplerIndex += 1;
				}else{
					gl[ "uniform" + thisp._uniformTypes[ e ].substring( 0, 2 ) + "v" ]
					( gl.getUniformLocation( thisp.program, e ), el );
				}
			});
		}
		tick(){
			this.curvalues = new Object();
			this.setFramebuffer();
			
			this.think();
			
			if( this.width != this.gl.canvas.width ||
					this.height != this.gl.canvas.height ){
				this.gl.canvas.width = this.width;
				this.gl.canvas.height = this.height;
				gl.viewport( 0, 0, this.gl.canvas.width, this.gl.canvas.height );
				gl.scissor( 0, 0, this.gl.canvas.width, this.gl.canvas.height );
				gl.enable( gl.SCISSOR_TEST );
			}
			
			this.setUniforms();

			this.gl.clearColor( 0.0, 0.0, 0.0, 0.0 );
			this.gl.clear( gl.COLOR_BUFFER_BIT );

			gl.drawArrays( gl.TRIANGLE_STRIP, 0, this.vertices );
			gl.bindFramebuffer( gl.FRAMEBUFFER, null );
			for( var i = 0; i < 32; ++i ){ // BUGBUG
				gl.activeTexture( gl[ "TEXTURE" + i ] );
				gl.bindTexture( gl.TEXTURE_2D, null );
			}
			//gl.flush();
			gl.finish();
			if( this.setsColor ){
				if( this.colorTexture !== undefined ){
					gl.useProgram( machine.passthrough );
					this.gl.clearColor( 0.0, 0.0, Math.random(), 1.0 );
					this.gl.clear( gl.COLOR_BUFFER_BIT );
					gl.activeTexture( gl.TEXTURE0 );
					gl.bindTexture( gl.TEXTURE_2D, this.colorTexture.tex );
					gl.uniform1i( gl.getUniformLocation( machine.passthrough,
																							 "colorbuffer" ), 0 );
					this.gl.clearColor( 0.0, 0.0, 0.0, 0.0 );
					this.gl.clear( gl.COLOR_BUFFER_BIT );
					gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
				}
				//gl.flush();
				gl.finish();
				this.ctx.transferFromImageBitmap(
					this.gl.canvas.transferToImageBitmap() );
			}
		}
		getMouse(){
			return [ -moused[ 0 ], moused[ 1 ] ];
		}
		getMouseButtons(){
			return mbuttons;
		}
		getMouseClicks(){
			return mouseclicks;
		}
		getMouseReleases(){
			return mousereleases;
		}
		getComps( str ){
			var ans = Number.parseInt( str[ 0 ] );
			if( ans == 6 ){
				ans += 10;
			}
			return ans;
		}
		getLen( name ){
			if( this.oldvalues[ name ] ){
				return this.getComps( this.oldvalues[ name ].type );
			}
			for( var i = 0; i < this._syntaxArrays.length; ++i ){
				if( this._syntaxArrays[ i ][ 0 ] == name ){
					return this.getComps( this._syntaxArrays[ i ][ 1 ][ 0 ]
																.substring( 1 ) );
				}
			}
			if( machine.values[ name ] && machine.values[ name ].type ){
				return this.getComps( machine.values[ name ].type );
			}
			if( machine.globals[ name ] ){
				return this.getComps( machine.globals[ name ].type );
			}
			return 1;
		}
		getValue( name, vname ){
			for( var i = 0; i < this._syntaxArrays.length; ++i ){
				if( this._syntaxArrays[ i ][ 0 ] == name ){
					if( typeof( this._syntaxArrays[ i ][ 1 ][ 0 ].value )
							!= "string" ){
						if( this._syntaxArrays[ i ][ 1 ][ 0 ].value === undefined ){
							var thisp = this;
							var nname = name;
							return function(){ return thisp.oldvalues[ nname ].val; }
						}
						return this._syntaxArrays[ i ][ 1 ][ 0 ].value;
					}else{
						return name;
					}
				}
			}
			if( machine.values[ name ] &&
					machine.values[ name ].value !== undefined ){
				if( machine.values[ name ].type.substring( 2, 3 ) == "u" ){
					var thisp = this;
					var func = function (){
						return machine.values[ name ].value( thisp );
					}
					return func;
				}else{
					return machine.values[ name ].value;
				}
			}
			if( machine.globals[ name ] ){
				return machine.globals[ name ].value;
			}
		}
		getType( name ){
			if( this.oldvalues[ name ] ){
				return this.oldvalues[ name ].type;
			}
			if( name.replace( /^[0-9]+$/, "" ) == "" ){
				return "1ic";
			}else if( name.replace( /^[0-9]+\.[0-9]*$/, "" ) == "" ){
				return "1fc";
			}
			for( var i = 0; i < this._syntaxArrays.length; ++i ){
				if( this._syntaxArrays[ i ][ 0 ] == name ){
					if( this._syntaxArrays[ i ][ 1 ][ 0 ].length == 4 ){
						return this._syntaxArrays[ i ][ 1 ][ 0 ].substring( 1, 4 );
					}else if( this._syntaxArrays[ i ][ 1 ][ 0 ] == "\\" ){
						//alert( "ret func " + name );
						return this._syntaxArrays[ i ][ 1 ][ 0 ].type;
					}
				}
			}
			if( machine.values[ name ] && machine.values[ name ].type ){
				return machine.values[ name ].type;
			}
			if( machine.globals[ name ] ){
				return machine.globals[ name ].type;
			}
		}
		// This produces the actual GPU programs.
		_compile( shaders ){
			var index = [ "vertex", "fragment" ];
			index.forEach( function( e ){
				var script = shaders[ e ];
				var type = gl[ e.toUpperCase() + "_SHADER" ];
				shaders[ e + "Shader" ] = gl.createShader( type );
				gl.shaderSource( shaders[ e + "Shader" ], script );
				gl.compileShader( shaders[ e + "Shader" ] );
				if( !gl.getShaderParameter( shaders[ e + "Shader" ],
																		gl.COMPILE_STATUS ) ){
	 				error( "Failed to compile shader " + e + ":\n\n" +
								 script + "\n\n" +
	 							 gl.getShaderInfoLog( shaders[ e + "Shader" ] ) );
				}
			});
			this.program = gl.createProgram();
			gl.attachShader( this.program, shaders.vertexShader );
			gl.deleteShader( shaders.vertexShader );
			delete shaders.vertexShader;
			gl.attachShader( this.program, shaders.fragmentShader );
			gl.deleteShader( shaders.fragmentShader );
			delete shaders.fragmentShader;
			gl.linkProgram( this.program );
			if( !gl.getProgramParameter( this.program, gl.LINK_STATUS ) ){
				var log = gl.getProgramInfoLog( this.program );
				if( log !== "" ){
					error( "Failed to link program:\n\n" + log );
				}
			}
		}	

		
		// Eval places a .value on the whole syntax tree. The value is either a
		// typed array for a constant, a thunk for a uniform, or some glsl for
		// GPU variables.
		_eval( shaders, name, tree ){
			var thisp = this;
			
			// The recursive helper function.
			function eh( shd, node, locals ){
				if( node[ 0 ] == "\\" ){
					let variability = node[ 0 ].type;
					while( variability instanceof Array ){
						variability = variability[ 0 ];
					}
					variability = variability.substring( 2, 3 );
					if( variability == "u" || variability == "c" ){
						node[ 0 ].value = function(){
						}
						alert( "Eval the lambda! " + JSON.stringify( node[ 0 ].type ) );
					}else{
						let boundargs = new Array();
						let ishd = shd
						let nlocals = new Object();
						let lambda = node[ 0 ];
						let func = node[ 1 ];
						for( let e in locals ){
							nlocals[ e ] = locals[ e ];
						}
						let ret = function(){
							alert("inside" + JSON.stringify( arguments ) + arguments.length );
							var nargs = new Array();
							for( let i = 0; i < arguments.length; ++ i ){
								nargs[ i ] = arguments[ i ];
							}
							boundargs = nargs.concat( boundargs );
							alert( "  " + boundargs.length + " <- ba ld -> " + lambda.type.length );
							if( boundargs.length == ( lambda.type.length - 1 ) ){
								for( let i = 1; i < lambda.type.length; ++i ){
									let n = lambda.type[ i ].name;
									alert( "binding " + n + " = " +
												 JSON.stringify( boundargs[ i ] ) );
									nlocals[ n ] = boundargs[ i ];
								}
								shd = eh( ishd, func, nlocals );

								alert( "funcvaltype " + typeof( func.value ) );
								return func.value;
							}else{
								return ret;
							}
						}
						ret.numargs = lambda.type.length - 1;
						node[ 0 ].value = ret;
						alert( "Glsl the lambda! " + JSON.stringify( node[ 0 ].type ) );
					}						
					return shd;
				}else{
					if( !(node instanceof String) ){
						let vals = new Array();
						let types = new Array();
						let start;
						if( node[ 0 ].substring( 0, 1 ) == "[" ){
							start = 2;
						}else{
							start = 1;
						}
						for( var i = start; i < node.length; ++i ){
							shd = eh( shd, node[ i ], locals ); 
							if( node[ i ] instanceof String ){
								vals.push( node[ i ].value );
								types.push( thisp.getType( node[ i ] ) );
							}else{
								vals.push( node[ i ][ 0 ].value );
								types.push( node[ i ][ 0 ].substring( 1, 4 ) );
							}
						}
						alert( JSON.stringify( vals ) );
						// Applications.
						if( node[ 0 ].substring( 0, 1 ) == "[" ){
							if( node[ 0 ].type instanceof Object ){
								let val = thisp.getValue( node[ 1 ] );
								if( val === undefined ){
									shd = eh( shd, node[ 1 ], locals );
									val = node[ 1 ].value;
								}
								alert( "vals len " + vals.length + JSON.stringify( vals ) + " \n typeof val : " + typeof( val ) );
								node[ 0 ].value = val.apply( thisp, vals ); 
							}else{
								if( !node[ 0 ].pos && !node[ 0 ].value ){
									node[ 0 ] = new String( node[ 0 ] );
								}
								if( node[ 0 ].substring( 3, 4 ) == "c" ){
									var val = machine.functions[ node[ 1 ] ].eval( vals );
									node[ 0 ].value = val;
								}else if( node[ 0 ].substring( 3, 4 ) == "u" ){
									node[ 0 ].value = function (){
										var nvals = new Array();
										for( var i = 0; i < vals.length; ++i ){
											if( vals[ i ] instanceof Function ){
												nvals.push( vals[ i ]() );
											}else{
												nvals.push( vals[ i ] );
											}
										}
										return machine.functions[ node[ 1 ] ].eval( nvals );
									}
									
									// GLSL.
								}else{
									var glsls = new Array();
									for( var i = 0; i < vals.length; ++i ){
										glsls.push( machine.getGlsl( vals[ i ], types[ i ], shd,
																								 thisp ) );
									}
									var mf = machine.functions[ node[ 1 ] ].trigger;
									if( mf !== undefined ){
										if( !thisp.triggered.has( mf ) ){
											thisp.triggered.add( mf );
											mf( shd, thisp );
										}
									}
									node[ 0 ].value = machine.functions[ node[ 1 ] ]
										.glsl( glsls, types );
								}
							}							
							// Constructors
						} else if( node[ 0 ].substring( 0, 1 ) == "(" ){
							if( !node[ 0 ].pos && !node[ 0 ].value ){
								node[ 0 ] = new String( node[ 0 ] );
							}
							if( node[ 0 ].substring( 3, 4 ) == "c" ){
								var ans = new Array();
								for( var i = 1; i < node.length; ++i ){
									var k = node[ i ].value;
									if( k === undefined ){
										k = node[ i ][ 0 ].value;
									}
									for( var j = 0; j < k.length; ++j ){
										ans.push( k[ j ] );
									}
								}
								if( node[ 0 ].substring( 2, 3 ) == "f" ){
									node[ 0 ].value = new Float32Array( ans );
								}else{
									node[ 0 ].value = new Int32Array( ans );
								}
							}else if( node[ 0 ].substring( 3, 4 ) == "u" ){
								node[ 0 ].value = function (){
									var ans = new Array();
									for( var i = 1; i < node.length; ++i ){
										var k = node[ i ].value;
										if( k === undefined ){
											k = node[ i ][ 0 ].value;
										}
										if( k instanceof Function ){
											k = k();
										}
										for( var j = 0; j < k.length; ++j ){
											ans.push( k[ j ] );
										}
									}
									if( node[ 0 ].substring( 2, 3 ) == "f" ){
									return new Float32Array( ans );
									}else{
										return new Int32Array( ans );
									}
								}
								// GLSL
							}else{
								var count = Number.parseInt( types[ 0 ].substring( 0, 1 ) );
								if( count == 6 ){
									count += 10;
								};
								var type = "";
								if( node[ 0 ].substring( 2, 3 ) == "i" ){
									type = "i";
								}
								var str = machine.getGlsl( vals[ 0 ], types[ 0 ], shd, thisp );
								for( var i = 1; i < vals.length; ++i ){
									var num = Number.parseInt( types[ i ].substring( 0, 1 ) );
									if( num == 6 ){
										num += 10;
									}
									count += num;
									str += ", " + machine.getGlsl( vals[ i ], types[ i ],
																								 shd, thisp  );
								}
								if( count != 1 ){
									str = type + machine.glslPrefix( count ) + "( " + str + " )";
								}
								node[ 0 ].value = str;
							}
						}
							// A string.
					}else{
						if( node.length >= 2
								&& node.replace( /^[0-9]+\.[0-9]*$/, "" ) == "" ){
							node.value = new Float32Array( 1 );
							node.value[ 0 ] = Number.parseFloat( node );
						}else if( node.replace( /^[0-9]+$/, "" ) == "" ){
							node.value = new Int32Array( 1 );
							node.value[ 0 ] = Number.parseInt( node );
						}else{
							if( locals[ node ] ){
								alert( "Found " + node + " locally" );
							}
							node.value = thisp.getValue( node, name );
						}
					}
					return shd;	
				}
			}
			let clocals = new Object();
			shaders = eh( shaders, tree, clocals );
			return shaders;
		}
		
		// Type is a 3 character combination of the form XYZ. X is the number of
		// components, 1, 2, 3, 4, 9, or 6 for 16. Y is f for float, i for
		// integer or s for string. Z is c for constant, u for frame constant, v
		// for vertex variable, f for fragemnt variable, and a for varying.
		_type( src, tree ){
			var thisp = this;
			function tah( src, pos, stype ){
				let ans = new String( stype );
				if( !stype || stype.length == 0 ){
					errorAtPlace( src, pos, "Empty type for argument:" );
				}
				if( stype.replace( /^[123469][if][ufvc]$/, "" ) == "" ){
					return ans;
				}
				let ansa = new Array();
				
				if( ans[ 0 ] == "(" && ans[ ans.length - 1 ] == ")" ){
					ans = ans.substring( 1, ans.length - 1 );
				}

				let spos = 0;
				while( spos < ans.length ){
					if( ans[ spos ] == "(" ){
						let end = spos + 1;
						let pc = 1;
						while( end < ans.length && pc != 0 ){
							if( ans[ end ] == "(" ){
								++pc;
							}else if( ans[ end ] == ")" ){
								--pc;
							}
							++end;
						}
						if( end > ans.length || ans[ end - 1 ] != ")" || pc != 0 ){
							errorAtPlace( src, pos, "Unbalanced parentheses in type:" );
						}
						ansa.push( tah( src, pos, ans.substring( spos, end ) ) );
						spos = end + 1;
					}else if( spos + 3 <= ans.length &&
										ans.substring( spos, spos + 3 )
										.replace( /^[123469][if][ufvc]$/, "" ) == "" ){
						ansa.push( new String( ans.substring( spos, spos + 3 ) ) );
						spos += 3;
						if( ans[ spos ] == "<" ){
							++spos;
						}
					}else{
						errorAtPlace( src, pos, "Malformed type:"
													+ ans.substring( spos ) );
					}
				}
				return ansa;
			}
			// Return true if type a is compatiple with b, e.g. a is 1fc and b is
			// 1fc, 1fu, 1ff, or 1fv. Or, if a is 2fu and b is 2fu, 2fv, or 2ff.
			// Returns false otherwise.
			function tcompat( a, b ){
				let as = typeof( a ) == "string" || a instanceof String;
				let bs = typeof( b ) == "string" || b instanceof String;
				if( ( as && !bs ) || ( !as && bs ) ){
					return false;
				}
				if( as ){
					let av = a.substring( 2, 3 );
					let bv = b.substring( 2, 3 );
					if( bv == "c" && !( av == "c" ) ){
						return false;
					}else if( bv == "u" && !( av == "u" || av == "c" ) ){
						return false;
					}else if( bv == "f" && av == "v" ){
						return false;
					}else if( bv == "v" && av == "f" ){
						return false;
					}
					return ( a.substring( 0, 2 ) == b.substring( 0, 2 ) );
				}else{
					if( a.length != b.length ){
						return false;
					}
					for( let e = 0; e < a.length; ++e ){
						if( !tcompat( a[ e ], b[ e ] ) ){
							return false;
						}
					}
					return true;
				}		
			}
			// Recursive type helper.
			function th( item, locals ){
				if( !( item instanceof String ) ){
					if( item[ 0 ] == "[" ){
						if( item.length < 2 ){
							errorAtPlace( src, item[ 0 ].pos, "Empty function call:" );
						}
						var types = new Array();
						for( var i = 2; i < item.length; ++i ){
							types.push( th( item[ i ], locals ) );
						}
						let ftype;
						if( item[ 1 ] instanceof String ){
							ftype = thisp.getType( item[ 1 ] );
							if( ftype === undefined && locals ){
								ftype = locals[ item[ 1 ] ];
							}
						}else{
							ftype = th( item[ 1 ], locals );							
						}
						if( ftype !== undefined ){
							if( !( ftype instanceof Array ) ){
								errorAtPlace( src, item[ 1 ].pos, "Expected a function:" );
							}
							if( types.length > ftype.length - 1 ){
								errorAtPlace( src, item[ 1 ].pos, "Too many arguments to" +
															" function:" );
							}
							for( let i = 0; i < types.length; ++i ){
								if( !tcompat( types[ types.length - ( i + 1 ) ],
															ftype[ ftype.length - ( i + 1 ) ] ) ){
									errorAtPlace( src, item[ item.length - ( i + 1 ) ].pos,
																"Argument type " +
																types[ types.length - ( i + 1 )] +
																" doesn't match function type " +
																ftype[ ftype.length - ( i + 1 ) ] + ":" );
								}
							}
							let ntype = ftype.slice( 0, ftype.length - types.length );
							if( ntype.length == 1 ){
								ntype = ntype[ 0 ];
							}
							//alert("type the lambda!" + JSON.stringify( ntype ) );
							item[ 0 ].type = ntype;
							return ntype;
						}
						if( !machine.functions[ item[ 1 ] ] ){
							errorAtPlace( src, item[ 1 ].pos, "Unknown function:" );
						}
						var ret = machine.functions[ item[ 1 ] ].type( types );
						if( ret.error ){
							errorAtPlace( src, item[ 1 ].pos, ret.error );
						}
						item[ 0 ] += ret;
						return ret;
					}else if( item[ 0 ] == "(" ){
						var types = new Array();
						for( var i = 1; i < item.length; ++i ){
							let tp = th( item[ i ], locals );
							if( !( tp instanceof String ) && typeof( tp ) != "string" ){
								errorAtPlace( src, item[ i ].pos, "Can't construct a vector "
															+ "with functions:" );
							}
							types.push( tp );
						}
						var len = 0;
						for( var i = 1; i < item.length; ++i ){
							if( item[ i ] instanceof String ){
								len += thisp.getLen( item[ i ] );
							}else{
								var c = Number.parseInt( item[ i ][ 0 ][ 1 ] );
								if( c === 6 ){
									c += 10;
								}
								len += c;
							}
						}						
						var at = types[ 0 ][ 1 ];
						for( var i = 1; i < types.length; ++i ){
							if( types[ i ][ 1 ] != at ){
								errorAtPlace( src, item[ 0 ].pos, "Inconsistent types:" );
							}
						}
						var comp = len;
						if( comp > 10 ){
							comp -= 10;
						}
						// Only float matrices.
						if( comp == 6 || comp == 9 ){
								at = "f";
						}
					
						var ret = comp + at + machine.getVariability( types );
						item[ 0 ] += ret;
						return ret;
						// Functions
					}else if( item[ 0 ] == "\\" ){
						if( item.length != 2 ){
							errorAtPlace( src, pos, "Function with no or multiple bodies" );
						}
						// Consume .args and generate .type
						item[ 0 ].type = new Array();
						item[ 0 ].type.names = new Object();
						for( let elem in item[ 0 ].args ){
							let ni = tah( src, item[ 0 ].pos, item[ 0 ].args[ elem ].type );
							ni.name = item[ 0 ].args[ elem ].name;
							item[ 0 ].type.push( ni );
							item[ 0 ].type.names[ ni.name ] = ni;
						}
						delete item[ 0 ].args;
						let nlocals = new Object();
						{
							if( locals ){
								for( let e in locals ){
									nlocals[ e ] = locals[ e ];
								}
							}
							for( let e in item[ 0 ].type.names ){
								nlocals[ e ] = item[ 0 ].type.names[ e ];
							}
						}
						let btype = th( item[ 1 ], nlocals );
						if( btype instanceof Array && btype.length > 1 ){
							item[ 0 ].type = btype.concat( item[ 0 ].type );
						}else{
							item[ 0 ].type = [btype].concat( item[ 0 ].type );
						}
						//alert( "func" + JSON.stringify( item[ 0 ].type ) );
						return item[ 0 ].type;
					}
				}else{
					// Not an array.
					if( item.length >= 2
							&& item.replace( /^[0-9]+\.[0-9]*$/, "" ) == "" ){
						return "1fc";
					}else if( item.replace( /^[0-9]+$/, "" ) == "" ){
						return "1ic";
					}else{
						var t = thisp.getType( item );
						if( t && t.length === 3 ){
							return t;
						}
						if( locals && locals[ item ] ){
							return locals[ item ];
						}
						errorAtPlace( src, item.pos, "Unknown identifier " + item + " :" );
					}
				}
			}
			th( tree[ 1 ] );
		}
		// Returns an abstract syntax tree.
		_parse( source ){
			var stack = new Array();
			stack.push( new Array() );
			var depth = 0;

			// Argument parsing helper.
			function pah( item, src, pos ){
				let rmspace = item.replace( /^ ?(.*[^ ]) ?$/, "$1" );
				let vt = rmspace.split( ":" );
				if( vt.length != 2 || vt[ 0 ].length == 0 || vt[ 1 ].length == 0 ){
					errorAtPlace( src, pos, "Malformed argument, too many \":\"s :" );
				}
				vt[ 0 ] = vt[ 0 ].replace( /^ ?(.*[^ ]) ?$/, "$1" )
				vt[ 1 ] = vt[ 1 ].replace( /^ ?(.*[^ ]) ?$/, "$1" )
				vt[ 1 ] = vt[ 1 ].replace( / </g, "<" );
				vt[ 1 ] = vt[ 1 ].replace( /< /g, "<" );
				if( vt[ 0 ].replace( /\s/g, "" ) != vt[ 0 ] ||
						vt[ 1 ].replace( /\s/g, "" ) != vt[ 1 ] ){
					errorAtPlace( src, pos, "Malformed argument:" );
				}
				let ans = new Object();
				ans.name = vt[ 0 ];
				ans.type = vt[ 1 ].replace( /\s/g, "" );
				return ans;
			}
			
			// Parse helper.
			function ph( src, begin ){
				if( src[ 0 ] !== "[" || src[ src.length - 1 ] !== "]" ){
					if( src[ 0 ] !== "(" || src[ src.length - 1 ] !== ")" ){
						errorAtPlace( src, 0,
													"Expected an expression in [] or ():" );
					}
				}
				if( begin >= source.length ){
					return [];
				}
				if( src[ begin ] === "[" ){
					stack.push( new Array() );
					depth += 1;
					// Handle functions.
					if( src[ begin + 1 ] && src[ begin + 1 ] == "\\" ){
						let s = new String( src.substring( begin + 2 ).
																split( ".", 1 )[ 0 ] );
						if( s == src.substring( begin + 2 ) ){
							errorAtPlace( src, begin + 1, "Malformed function" );
						}
						if( src[ begin + s.length + 3 ] == "]" ){
							errorAtPlace( src, begin + 1, "Empty body in function:" );
						}
						let ans = new String( "\\" );
						ans.pos = begin + 2;
						{
							let ss = s.split( "," );
							ans.args = new Array();
							for( let e in ss ){
								if( ss[ e ].length > 0 && ss[ e ].replace( /\s/g, "" ) != "" ){
									ans.args.push( pah( ss[ e ], src, ans.pos ) );
								}
							}
						}
						stack[ depth ].push( ans );
						ph( src, begin + 3 + s.length );
					}else{
						let s = new String( "[" );
						s.pos = begin;
						stack[ depth ].push( s );
						ph( src, begin + 1 );
					}
				} else if( src[ begin ] === "]" ){
					if( depth === 0 ){
						errorAtPlace( src, begin, "Too many ]s in expression:" );
					}
					if( stack[ depth ][ 0 ] != "["
							&&  stack[ depth ][ 0 ] != "\\" ){
						errorAtPlace( src, begin, "Expected ) not ]:" );
					}
					stack[ depth - 1 ].push( stack.pop() );
					depth -= 1;
					var offset = 1;
					if( ( stack[ depth ][ 0 ] == "[" &&
								src[ begin + 1 ] == " " ) ||
							( stack[ depth ][ 0 ] == "(" &&
								src[ begin + 1 ] == "," ) ){
						offset += 1;
					}
					if( begin + offset >= src.length ){
						return
					} else{
						ph( src, begin + offset );
					}
				} else if( src[ begin ] === "(" ){
					stack.push( new Array() );
					depth += 1;
					var s = new String( "(" );
					s.pos = begin;
					stack[ depth ].push( s );
					ph( src, begin + 1 );
				} else if( src[ begin ] === ")" ){
					if( depth === 0 ){
						errorAtPlace( src, begin, "Too many ]s in expression:" );
					}
					if( stack[ depth ][ 0 ] != "(" ){
						errorAtPlace( src, begin, "Expected ] not ):" );
					}
					stack[ depth - 1 ].push( stack.pop() );
					depth -= 1;
					var offset = 1;
					if( ( stack[ depth ][ 0 ] == "[" &&
								src[ begin + 1 ] == " " ) ||
							( stack[ depth ][ 0 ] == "(" &&
								src[ begin + 1 ] == "," ) ){
						offset += 1;
					}
					if( begin + offset >= src.length ){
						return;
					} else{
						ph( src, begin + offset );
					}
				} else{
					var ss = src.substring( begin )
							.split( /^([^ ,\[\]\(\)]*)([ ,\[\]\(\)])/ );
					var ida = new String( ss[1] );
					if( !ida || !ida.length ){
						errorAtPlace( src, begin, "Expected identifier:" );
					}
					var nb = begin + ida.length;
					if( ss[ 2 ] === " " ){
						if( stack[ depth ][ 0 ] != "[" ){
							errorAtPlace( src, begin + ida.length,
														"Expected comma not space:" );
						}
						nb += 1;
					} else if( ss[ 2 ] === "," ){
						if( stack[ depth ][ 0 ] != "(" ){
							errorAtPlace( src, begin + ida.length,
														"Expected space not comma:" );
						}
						nb += 1;
					}
					ida.pos = begin;
					stack[ depth ].push( ida );
					ph( src, nb );
				}				
			}
			{
				ph( source, 0 );
				if( depth !== 0 ){
					errorAtPlace( source, 0, "Too many [s in expression:" );
				}
			}
			return stack[ 0 ][ 0 ];
		}
	}

	
  function logAtPlace( src, n, msg, cls ){
    var hr = document.createElement( "hr" );
    var nd = document.createElement( "div" );
    nd.classList.add( cls.toLowerCase() );
    nd.classList.add( "lnz" );
    nd.innerHTML = "<h1><em>" + cls + "</em></h1>";
		nd.innerHTML += "<p>" + msg + "</p>";
    var pre1 = document.createElement( "pre" );
    var pre2 = document.createElement( "pre" );
    var pre3 = document.createElement( "pre" );
		pre1.style = pre2.style = pre3.style = "display: inline";
		pre2.style = "display: inline;color: red";
    pre1.appendChild( document.createTextNode( src.substring( 0, n ) ) );
		pre2.appendChild( document.createTextNode( ">" +
																							 src.substring( n, n + 1 )
																							 + "<" ) );
    pre3.appendChild( document.createTextNode(
			src.substring( n + 1, src.length ) ) );
    nd.appendChild( pre1 );
    nd.appendChild( pre2 );
    nd.appendChild( pre3 );
    document.body.insertBefore( hr, document.body.childNodes[ 0 ] );
    document.body.insertBefore( nd, hr );
    window.scrollTo( 0.0, 0.0 );
  }
  function log( msg, cls, relog ){
    var hr = document.createElement( "hr" );
    var nd;
		if( relog && !document.querySelector( ".lnz." + cls.toLowerCase() ) ){
			relog = false;
		}
		if( relog ){
			nd = document.querySelector( ".lnz." + cls.toLowerCase() );
		}else{
			nd = document.createElement( "div" );
			nd.classList.add( cls.toLowerCase() );
			nd.classList.add( "lnz" );
		}
    nd.innerHTML = "<h1><em>" + cls + "</em></h1>";
		if( cls === "Error" )
			nd.innerHTML += "<p>The following fatal error occured:</p>";
    var pre = document.createElement( "pre" );
    pre.appendChild( document.createTextNode( msg ) );
    nd.appendChild( pre );
		if( !relog ){
			document.body.insertBefore( hr, document.body.childNodes[ 0 ] );
			document.body.insertBefore( nd, hr );
			window.scrollTo( 0.0, 0.0 );
		}
  }
  function info( msg, relog ){
    log( msg, "Information", relog );
  }
  function error( msg ){
    log( msg, "Error" );
		if( machine.log && machine.log != "" ){
			log( machine.log, "Log", true );
			machine.log = "";
		}
		throw msg;
  }
	function errorAtPlace( src, begin, msg ){
		logAtPlace( src, begin, msg, "Error" );
		throw msg;
	}
  function exec( elem ){
		var canvas = document.createElement( "canvas" );
		var context = canvas.getContext( "bitmaprenderer" );
		var sources = new Array();
		var vertices = 4;
		var _globals = new Object();
		var sname = "";
		
		canvas.width = exp.defaultWidth;
		canvas.height = exp.defaultHeight;
		if( elem.id ){
			sname = elem.id;
		}
		{
			var ns = elem.text.replace( /\s/g, "" );
			if( ns[ ns.length - 1 ] != ";" ){
				error( "Missing last semicolon" );
			}
		}
		var oldvalues = new Object;
		elem.text.split( ";\n" ).forEach( function( l ){
			var command, name;
			{
				var s = l;
				if( s.replace(/\s/g,'').length ){
					s = s.split( "=", 2 )
					if( s.length !== 2 ){
						error( "Malformed lnz script." );
					}
					name = s[ 0 ].replace( /\s/g, "" );
					if( name[ 0 ] == "." ){
						_globals[ name ] = true;
						name = name.replace( /^\.?(.*)$/, "$1" );
					}
					command = l.replace( /[^=]*=/, "" );



					//Handle textures
					var isfilename = false;
					if( command.replace( /^ *[^<> ]+\.... *$/, "" ) == "" ){
						isfilename = true;
					}
					// RTT
					if( name[ 0 ] == "*" && !isfilename &&
							command.replace( /\s/g, "" )
							.replace( /[0-9][fi][0-9]/, "" ) == "" ){
						
						var tname = name.substring( 1 );
						if( tname[ 0 ] == "#" ){
							tname = tname.substring( 1 );
						}
						if( textures[ name ] !== undefined ){
							error( "Attempt to redeclare texture " + tname + ":" );
						}
						
						machine.functions[ name ] = new Object;
						var aname = name;
						machine.functions[ name ].type = function( types ){
							var ans = new Object;
							if( types.length != 1 ){
								ans.error = "Wrong number of arguments to texture function:";
								return ans;
							}
							if( types[ 0 ] != "2fa" && types[ 0 ] != "2fv"
									&& types[ 0 ] != "2ff" ){
								ans.error = "Wrong type " + types[ 0 ] +
									" of argument to texture function:";
								return ans;
							}
							return textures[ aname ].type.substring( 0, 2 )
								+ types[ 0 ].substring( 2, 3 );
						}
						machine.functions[ name ].glsl = function( glsls, types ){
								return "texture( " + tname + ", " + glsls[ 0 ] + " )";
						}
						var grabname = name;
						machine.functions[ name ].trigger = function( shaders, thisp ){
							if( thisp.readFrom === undefined ){
								thisp.readFrom = new Object;
							}
							thisp.readFrom[ name ] = true;
							shaders.fragmentHeader += "uniform sampler2D " + tname + ";\n";
							shaders.vertexHeader += "uniform sampler2D " + tname + ";\n";
							thisp._uniformTypes[ grabname ] = "s";
						}
						
						textures[ name ] = new Object();
						textures[ name ].type = "4f2";
						// normal texture
					}else if( name[ 0 ] == "*" && isfilename ){
						var tname = name.substring( 1 );
						if( tname[ 0 ] == "#" ){
							tname = tname.substring( 1 );
						}
						if( textures[ name ] !== undefined ){
							error( "Attempt to redefine texture " + tname + ":" );
						}
						
						var tex = gl.createTexture();
						textures[ name ] = new Object();
						textures[ name ].tex = tex;
						textures[ name ].type = "4f2";
						textures[ name ].format = gl.RGBA;
						textures[ name ].width = canvas.width;
						textures[ name ].height = canvas.height;
						textures[ name ].ttype = gl.TEXTURE_2D;
						textures[ name ].internalFormat = gl.UNSIGNED_BYTE;
						textures[ name ].filter = gl.LINEAR;

						if( dbg ){ info( "Creating and binding normal texture." ); }
						gl.bindTexture( gl.TEXTURE_2D, tex );
		

						gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA,
													 gl.UNSIGNED_BYTE,
													 new Uint8Array( [ 255, 0, 255, 255 ] ) );
							gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,
																gl.CLAMP_TO_EDGE );
							gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,
																gl.CLAMP_TO_EDGE );

						const img = new Image();
						img.crossOrigin = "anonymous";
						img.onload = function(){
							if( dbg ){ info( "Image " +  img.width + "x" + img.height ); }
							gl.bindTexture( gl.TEXTURE_2D, tex );
							gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, img.width, img.height,
														 0, gl.RGBA, gl.UNSIGNED_BYTE, img );
							if( name[ 1 ] == "#" ){
								if( dbg ){ info( "Mipmapping texture" ); }
								gl.generateMipmap( gl.TEXTURE_2D );
								if( anisotropyExt ){
									var max =
											gl.getParameter(
												anisotropyExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT );
									textures[ name ].filter = max;
									gl.texParameterf( gl.TEXTURE_2D,
																		anisotropyExt.TEXTURE_MAX_ANISOTROPY_EXT
																		, max );
								}else{
									textures[ name ].filter = gl.LINEAR_MIPMAP_LINEAR;
									gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER,
																		gl.LINEAR );
									gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
																		gl.LINEAR_MIPMAP_LINEAR );
								}
							}else{
								gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER,
																	gl.LINEAR );
								gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
																	gl.LINEAR );
							}
						}

						img.src = command.replace( /\s/g, "" );
						
						machine.functions[ name ] = new Object;
						machine.functions[ name ].type = function( types ){
							var ans = new Object;
							if( types.length != 1 ){
								ans.error = "Wrong number of arguments to texture function:";
								return ans;
							}
							if( types[ 0 ] != "2fa" && types[ 0 ] != "2fv"
									&& types[ 0 ] != "2ff" ){
								ans.error = "Wrong type of argument to texture function:";
								return ans;
							}
							return textures[ name ].type.substring( 0, 2 )
								+ types[ 0 ].substring( 2, 3 );
						}
						machine.functions[ name ].glsl = function( glsls, types ){
							return "texture( " + tname + ", " + glsls[ 0 ] + " )";
						}
						machine.functions[ name ].trigger = function( shaders, thisp ){
							shaders.fragmentHeader += "uniform sampler2D " + tname + ";\n";
							shaders.vertexHeader += "uniform sampler2D " + tname + ";\n";		
							thisp._uniformTypes[ name ] = "s";
						}



						// Everything else.
					}else{
						switch( name ){
						case "Height":
						case "Width":
							var l;
							var c = command.replace( /\s/g, "" );
							if( c[ c.length - 1 ] === "%" ){
								l = c.substring( 0, c.length - 1 ) * 0.01 * 
									window[ "inner" + name ]; 
							} else {
								l = c;
							}
							canvas[ name.toLowerCase() ] = l;
							break;
						case "Vertices":
							// BUGBUG
						vertices = Number.parseInt( command );
							break;
						case "Display":
							canvas.style[ name ] = command;
							break;
						default:
							// Handle declerations.
							var c = command.replace( /\s/g, "" );
							if( command.replace( new RegExp(
								"^\\s*[1-9][if]\\(((\\s*[0-9]+\\.?[0-9]*\\s*,\\s*)*" +
									"(\\s*[0-9]+\\.?[0-9]*\\s*))?\\)\\s*$" ), "" ) == "" ){
								var n = Number.parseInt( c[ 0 ] );
								if( n == 6 ){
									n == 16;
								}
								if( ( n > 4 && n != 9 && n != 16 ) || n <= 0 ){
									error( "Declaration with faulty component number." );
								}

								oldvalues[ name ] = new Object();
								oldvalues[ name ].type = c.substring( 0, 2 ) + "u";
								let func;
								if( c[ 1 ] == "f" ){
									func = Number.parseFloat;
									oldvalues[ name ].val = new Float32Array( n );
								}else{
									func = Number.parseInt;
									oldvalues[ name ].val = new Int32Array( n );
								}
								let valstrings = c.substring( 3, c.length - 2).split( "," );
								if( valstrings[ 0 ] == "(" ){
									valstrings.pop();
								}
								for( let i = 0; i < valstrings.length; ++i ){
									oldvalues[ name ].val[ i ] = func( valstrings[ i ] );
								}
							}else{
								sources.push( [ name, command ] );
							}
							break;
						}
					}
				}
			}
		});
		var nm = new Machine( sname, gl, context, vertices, sources, oldvalues,
													canvas, _globals );
		machines.push( nm );
		if( nm.setsColor ){
			elem.parentElement.insertBefore( canvas, elem );
		}
	}
  function init(){
		// First collect machine and clean DOM.
		{
			var qs = document.querySelector( "script#mainfunctions.lnz" );
			machine = qs.exp;
			machine.info = info;
			machine.globals = new Object();
			machine.postThunks = new Array();
			qs.parentElement.removeChild( qs );

		}
		machine.log = "";
		
		// Insert style
		{
			var l = document.createElement( "link" );
			l.rel = "stylesheet";
			l.href = "lnz.css";
			document.head.appendChild( l );
		}

		// Get context.
    canvas = new OffscreenCanvas( exp.defaultWidth, exp.defaultHeight );
		canvas.width = exp.defaultWidth;
		canvas.height = exp.defaultHeight;
		gl = canvas.getContext( "webgl2" );
		anisotropyExt = (
			gl.getExtension( "EXT_texture_filter_anisotropic" ) ||
				gl.getExtension( "MOZ_EXT_texture_filter_anisotropic" ) ||
				gl.getExtension( "WEBKIT_EXT_texture_filter_anisotropic" )
		);
		if( !canvas || !gl ){
			error( "Unable to get WebGL2 context" );
		}
		if( !gl.getExtension( "EXT_color_buffer_float" ) ){
			error( "No float buffer support!" );
		}

		// Execute scripts.
		document.querySelectorAll( 'script.lnz[type="text/plain"]' ).
			forEach( exec );

		// Compile passthrough shader.
		{
			var index = [ "Vertex", "Fragment" ];
			index.forEach( function( e ){
				var script = machine[ "passthrough" + e ];
				var type = gl[ e.toUpperCase() + "_SHADER" ];
				machine[ "passthrough" + e ] = gl.createShader( type );
				gl.shaderSource( machine[ "passthrough" + e ], script );
				gl.compileShader( machine[ "passthrough" + e ] );
				if( !gl.getShaderParameter( machine[ "passthrough" + e ] ,
																		gl.COMPILE_STATUS ) ){
	 				error( "Failed to compile passthrough shader " + e + ":\n\n" +
	 							 gl.getShaderInfoLog(  machine[ "passthrough" + e ] ) );
				}
			});
			machine.passthrough = gl.createProgram();
			gl.attachShader( machine.passthrough, machine.passthroughVertex );
			gl.deleteShader( machine.passthroughVertex );
			delete machine.passthroughVertex;
			gl.attachShader( machine.passthrough, machine.passthroughFragment );
			gl.deleteShader( machine.passthroughFragment );
			delete machine.passthroughFragment;
			gl.linkProgram( machine.passthrough );
			if( !gl.getProgramParameter( machine.passthrough, gl.LINK_STATUS ) ){
				var logp = gl.getProgramInfoLog( machine.passthrough );
				if( logp !== "" ){
					error( "Failed to link passthrough shader:\n\n" + logp );
				}
			}
		}	
		
		// Done with init logic, this is the per tick function.
		var ot = 0;
		var omx, omy;
		var obuttons = 0;
		var framenum = 0;
		var lastframe = performance.now();
		var fps = 60.0;
		function doticks(){
			for( var e in machines ){
				if( dbg ){
					machine.log += "\nBeginning tick " + framenum + " for machine " + e
						+ "\n";
				}
				machines[ e ].tick();
				if( dbg && machines[ e ].framebuffer ){
					gl.bindFramebuffer( gl.FRAMEBUFFER, machines[ e ].framebuffer.fb );
					var cfb = gl.checkFramebufferStatus( gl.FRAMEBUFFER );
					if( cfb != gl.FRAMEBUFFER_COMPLETE ){
						for( var wi in gl ){
							if( gl[ wi ] == cfb ){
								cfb = wi;
							}
						}
						error( "Bad framebuffer! " + cfb + " on " + e );
					}
				}
			}
		}
		function frame( t ){
			if( dbg ){ machine.log += "Mouse: " + moused + "  ,  " + mbuttons; }
			if( machine.log && machine.log != "" ){
				log( machine.log, "Log", true );
				machine.log = "";
			}
			if( omx !== undefined ){
				moused[ 0 ] = mousex - omx;
				moused[ 1 ] = mousey - omy;
			}
			mouseclicks = 0;
			mousereleases = 0;
			for( var i = 1; i <= 16384; i *= 2 ){
				if( ( mbuttons & i ) && !( obuttons & i ) ){
					mouseclicks += i;
				}
				if( !( mbuttons & i ) && ( obuttons & i ) ){
					mousereleases += i;
				}
			}
			obuttons = mbuttons;
			omx = mousex;
			omy = mousey;
			doticks();
			if( dbg ){
				var err = gl.getError()
				if( err ){
					for( var e in gl ){
						if( err == gl[ e ] ){
							error( "Webgl error: " + e );
						}
					}
				}
			}
			ot = t;
			if( showfps ){
				var scale = 0.99;
				var now = performance.now();
				fps = fps * scale +
						( 1 - scale ) * ( 1000.0 / ( now - lastframe ) );
				lastframe = now;
				machine.log += "Frame: " + framenum + "\nFPS: " + fps + "\n";
			}
			++framenum;
			machine.postThunks.forEach( function( e ){
				e();
			});
			// Delete curvalues.
			for( let e in Object.keys( machines ) ){
				if( machines[ e ].curvalues ){
					delete machines[ e ].curvalues;
				}
			}
		}
		function doframe(){ 
			frame();
			//window.setTimeout( doframe, 1 );
			window.requestAnimationFrame( doframe );
		}
		doframe();
	}
 
  function injectScripts( names, next ){
    if( names.length === 0 ){
      next();
      return;
    }
    var name = names.pop();
    document.querySelector( "p" ).innerHTML += name;
    var s = document.createElement( "script" );
    s.async = false;
    s.classList.add( "lnz" );
    s.id = name;
    s.onload = function(){ injectScripts( names, next ) };
    s.src = name + ".js";
    document.body.appendChild( s );
  }

	function webglInfo(){
		infos = [
			"MAX_COMBINED_TEXTURE_IMAGE_UNITS", "i",	 
			"MAX_CUBE_MAP_TEXTURE_SIZE", "i",	 
			"MAX_FRAGMENT_UNIFORM_VECTORS", "i",	 
			"MAX_RENDERBUFFER_SIZE", "i",	 
			"MAX_TEXTURE_IMAGE_UNITS", "i",	 
			"MAX_TEXTURE_SIZE", "i",	 
			"MAX_VARYING_VECTORS", "i",	 
			"MAX_VERTEX_ATTRIBS", "i",	 
			"MAX_VERTEX_TEXTURE_IMAGE_UNITS", "i",	 
			"MAX_VERTEX_UNIFORM_VECTORS", "i",	 
			"MAX_VIEWPORT_DIMS", "2i",
			"MAX_3D_TEXTURE_SIZE", "i",	 
			"MAX_ARRAY_TEXTURE_LAYERS", "i",	 
			"MAX_CLIENT_WAIT_TIMEOUT_WEBGL", "i64",	 
			"MAX_COLOR_ATTACHMENTS", "i",	 
			"MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS", "i64",	 
			"MAX_COMBINED_UNIFORM_BLOCKS", "i",	 
			"MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS", "i64",	 
			"MAX_DRAW_BUFFERS", "i",	 
			"MAX_ELEMENT_INDEX", "i64",	 
			"MAX_ELEMENTS_INDICES", "i",	 
			"MAX_ELEMENTS_VERTICES", "i",	 
			"MAX_FRAGMENT_INPUT_COMPONENTS", "i",	 
			"MAX_FRAGMENT_UNIFORM_BLOCKS", "i",	 
			"MAX_FRAGMENT_UNIFORM_COMPONENTS", "i",	 
			"MAX_PROGRAM_TEXEL_OFFSET", "i",	 
			"MAX_SAMPLES", "i",	 
			"MAX_SERVER_WAIT_TIMEOUT", "i64",	 
			"MAX_TEXTURE_LOD_BIAS", "f",	 
			"MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS", "i",	 
			"MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS", "i",	 
			"MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS", "i",	 
			"MAX_UNIFORM_BLOCK_SIZE", "i64",	 
			"MAX_UNIFORM_BUFFER_BINDINGS", "i",	 
			"MAX_VARYING_COMPONENTS", "i",	 
			"MAX_VERTEX_OUTPUT_COMPONENTS", "i",	 
			"MAX_VERTEX_UNIFORM_BLOCKS", "i",	 
			"MAX_VERTEX_UNIFORM_COMPONENTS", "i",
			"MAX_COLOR_ATTACHMENTS", "i",
			"MAX_DRAW_BUFFERS", "i" ];
			
		var tab = "";
		for( var i = 0; i < infos.length; i += 2 ){
			inf = infos[ i ];
			type = infos[ i + 1 ];
			tab += "gl." + inf + " : ";
			switch( type ){
			case "i":
			case "f":
			case "i64":
				tab += gl.getParameter( gl[ inf ] ) + "\n";
				break;
			case "2i":
				tab += gl.getParameter( gl[ inf ] )[ 0 ] + "x" +
					gl.getParameter( gl[ inf ] )[ 1 ] + "\n";
			}
		}
		if( anisotropyExt ){
			tab += "gl.TEXTURE_MAX_ANISOTROPY_EXT : ";
			tab += gl.getParameter(
				anisotropyExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT ) + "\n";
		}
		tab += "\n\nAvailable extensions:\n";
		var exts = gl.getSupportedExtensions();
		for( var ext in exts ){
			tab += exts[ ext ] + "\n";
		}
		info( tab );
	}

  injectScripts( [ "mainfunctions" ], init );
  
	exp.webglInfo = webglInfo;
	exp.error = error;
  exp.info = info;
	
  lnz = exp;
});
