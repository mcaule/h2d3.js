(function(factory){
	if(typeof define === "function"  && define.amd)
	{
		define(['d3','d3-tip'],factory)
	}else{
		if(d3 && d3.tip)
			window.h2d3 = factory(d3,d3.tip)
		else
			window.h2d3 = factory(d3)
	}
}(
function(d3,d3tip)
{

var h2d3 = {};

var hasTip = !(typeof d3tip === "undefined")


h2d3.modeNames = {
	'N':'Normal',
	'S':'Stacked',
	'SP':'Percent',
	'C':'Center'
}

h2d3.styles = {	
	default:["#a6cee3","#ff7f00","#b2df8a","#1f78b4","#fdbf6f","#33a02c","#cab2d6","#6a3d9a","#fb9a99","#e31a1c","#ffff99","#b15928"],
	pastel:["#61C0E7","#E381B8","#53CDB5","#DC8165","#C296C6","#70AEC3","#6BBA7F","#D39150","#DC7E87","#8DA4D5","#A0B350","#CEAA38"],
	darkpastel:["#61C0E7","#E381B8","#53CDB5","#DC8165","#C296C6","#70AEC3","#6BBA7F","#D39150","#DC7E87","#8DA4D5","#A0B350","#CEAA38"],
	colorblind:["#999999", "#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7"]				 
}
h2d3.chart = function()
{	

	//chart size
	var _width = 600
	var _height = 400

	//scales size (minus margin + axis sizes)
	var width = 600
	var height = 400

	var margin = {top: 20, right: 20, bottom: 20, left: 20, axis:5}
	var modes = ['N','S','SP','C']	
	var _disabledModes = []
	var _mode = ''
	var _tickFormat = d3.format() //initial tick format
	var tickFormat = _tickFormat //current tick format (depending on the mode exemple:percent)
	var _vertical = false
	var _selectSeries = true
	var _hidden = []
	var _sortV = ''
	var _colors = null

	var scales = {}
	var drawFunctions = {}
	var serieMap = {}
	var mdata = null
	var nseries = 0

	var svg = null
	var chartContent = null
	// bool to test if data contains negatives value (so impossible to use stacked mode)
	var hasNegValue = false;

	var xAxis,yAxis;
	//bool to remember to rotate xlabel during sort function
	var hasRotateXLabels = false

	var _style  = 'default'
	var _tipFunction = function(d) {
	  	var v = _mode=='SP' ? d.percent : d.value
	    return ' <span style="color:'+scales.color(serieMap[d.key].index)+'">'+d.key+'</span><span class="h2d3-tip_text '+_style+'" > : '+ tickFormat(v) + '</span>';
	  }

	
	var tip = null

	function chart(el,data){

				
		nseries = data.length
		/* preprocess data : create dict of series */
		mdata = preprocessData(data);		

		var serieArr = data.map(function(d){return d.key})
		
		/* base size and margin*/
		width = _width
		height = _height - margin.bottom;

		/* test wich mode are available based on data */
		var available_modes = []
		for (var i = 0; i<modes.length; i++) {
				if( !(nseries!=2 && modes[i]=='C') &&
					!(hasNegValue && (modes[i]!='N'))
					&& _disabledModes.indexOf(modes[i])==-1
						
				  ){
					available_modes.push(modes[i])
				}
			};	

		if(_mode=='')
			_mode = available_modes[0]
		else if(available_modes.indexOf(_mode)==-1)
		{
			if(hasNegValue)
				console.log('h2d3 : mode '+h2d3.modeNames[_mode]+' not compatible with data (negatives values)')
			else
				console.log('h2d3 : mode '+h2d3.modeNames[_mode]+' not compatible with data')				
			_mode = available_modes[0]
		}

		
		/* create svg */
		svg = d3.select(el).append('svg')
			.attr('class','h2d3 '+_style)
		    .attr('width', width )
		    .attr('height', height  + margin.bottom)
			.append('g')

		/* create control (switch mode buttons) */
		createControls(available_modes)

		/* change height of chart based on height of controls */
		var controlsBox = svg.select('.h2d3_controls')[0][0].getBBox()

		/* create colorscale (used in legend) */
		var colorScale = d3.scale.ordinal()
			.domain(d3.range(nseries))

		if(_colors==null)
			colorScale.range(h2d3.styles[_style])
		else
			colorScale.range(_colors)

		scales   = {color:colorScale}

		/* create legend */
		createLegend(serieArr,controlsBox.width)		

		/* change height of chart based of height of legend and controls */
		var legendBox = svg.select('.h2d3_legend')[0][0].getBBox()
		var toolsHeight = Math.max(legendBox.height,controlsBox.height)

		svg.select('.h2d3_controls').attr('transform','translate(0,-'+toolsHeight+')')
		margin.top = margin.top+toolsHeight

		height = height - margin.top-margin.bottom-margin.axis;				

		/* create containers */
		var chartContent = svg.append('g')
		

		tickFormat = _tickFormat
		/* change tick format depending on mode*/
		if(_mode=='SP')
			tickFormat = d3.format('.2p') // percent
		else if(_mode=='C')
			tickFormat = function(n){return _tickFormat(Math.abs(n))} // non-negative centerscale

		/* create y axis (bar or group axis depending of vertical/horizontal)*/
		yAxis = createYAxis()
						
		chartContent.append('g')
		      .attr('class', 'h2d3_axis y '+_style+' '+(_vertical? 'barAxis' : 'groupAxis' ))
		      .call(yAxis)
		      .attr('transform','translate(-'+margin.axis+',0)')

		/* change width of chart based on width of y axis (groups labels) */
		/* allow very long labels (compress the chart to the right) */
		var yAxisWidth = svg.select('.h2d3_axis.y')[0][0].getBBox().width

		width  = width -(margin.left+yAxisWidth) -margin.right-margin.axis

		svg.attr('transform','translate(' + margin.left + ',' + margin.top + ')')
		chartContent.attr('transform','translate('+(margin.axis+yAxisWidth)+',0)')


		/* create x axis (bar or group axis depending of vertical/horizontal)*/
		xAxis = createXAxis()

		chartContent.append('g')
				  .attr('class', 'h2d3_axis x '+_style+' '+(_vertical? 'groupAxis' : 'barAxis' ))
				  .attr('transform', 'translate(0,' + (height+margin.axis) + ')')
				  .call(xAxis);

		/* rotate x axis labels if needed */		
		var dy_xAxis = rotateXLabels(xAxis)

		/* if very long labels, rotate + compress chart to the top*/
		if(dy_xAxis>0)
		{
			/* height of xAxis modified -> change margin */
			height = height-dy_xAxis
			yAxis = createYAxis()
			chartContent.select('.h2d3_axis.y')
				.call(yAxis)
			chartContent.select('.h2d3_axis.x')
				 .attr('transform', 'translate(0,' + (height+margin.axis) + ')')
			hasRotateXLabels = true
		}

		
		/* draw grid background */
		
		chartContent.insert('rect',':first-child')
			.attr('width',width+margin.axis)
			.attr('height',height+margin.axis)
			.attr('x',-margin.axis)
			.attr('y',0)
			.attr('class','h2d3_gridbg '+_style)

		/*
		barContainer.selectAll('h2d3_grid')
					.call(drawGrid)
		*/
		drawGrid(chartContent)			

		/* container for bars */
		var barContainer = chartContent.append('g')		

		/* base mode is horizontal, rotate(_90) to vertical*/
		if(_vertical)
		{
			/* vertical mode : rotate and translate chart*/
			barContainer.attr('transform','rotate(-90) translate(-'+height+',0)')
		}

		if(hasTip)
		{
			createTip()
			barContainer.call(tip)
			chart.tip = tip
		}
		/* create groups */
		var group = barContainer.selectAll('.h2d3_group')
			  .data(mdata)
			  .enter().append('g')
			  .attr('class','h2d3_group')
			  .attr('transform',function(d){return 'translate(0,'+scales.group(d.label)+')';})

		

		/* draw function : set bar's position */
		var drawFunction = drawFunctions[_mode]

		/* create bars */
		var bars = group.selectAll('.h2d3_bar')
			.data(function(d)
			{
				/* sort data */
				d.series.sort(function(a,b){
			  		return serieMap[a.key].index - serieMap[b.key].index;
			  	})
				/* cumulative data for stacked and stacked percent modes */
				createCumulatives(d);

				return d.series;
			})
			.enter().append('rect')
			.attr('class',function(d){
				/* add css to bar to customize series color on css */
				return 'h2d3_bar h2d3_serie_'+createCSSValidClassName(d.key);
			})
			.attr('fill',function(d){return colorScale(serieMap[d.key].index);})
			.call(drawFunction)

		if(hasTip)
		{
			bars.on('mouseover',tip.show)
				.on('mouseout',tip.hide)
		}

		/* sort based on param sort value*/
		if(_sortV!='')
		{
			sort(_sortV)
		}

		/* add public functions after first draw*/
		chart.sort = sort
		chart.changeMode = changeMode
		chart.hide = hide
	}

	chart.vertical = function(_)
	{
		if(!arguments.length || _)
			_vertical = true
			return chart
	}

	chart.width=function(_)
	{
		if(!arguments.length) return _width
		_width=_
		return chart
	}

	chart.height=function(_)
	{
		if(!arguments.length) return _height
		_height=_
		return chart
	}

	chart.tickFormat=function(_)
	{
		if(!arguments.length) return _tickFormat
		if(typeof _ == 'string')
			_ = d3.format(_)
		_tickFormat=_
		return chart
	}

	chart.selectSeries=function(_)
	{
		if(!arguments.length) return _selectSeries
		_selectSeries=_
		return chart
	}

	chart.colors=function(_)
	{
		if(!arguments.length) return _colors
		_colors=_
		return chart
	}


	chart.margin=function(_)
	{
		if(!arguments.length) return margin
		margin=_
		return chart
	}

	/*
	percent mode feature : 
	chart.percentMode(activate,start=false)
	if activate is false then percent mode is not used
	if start is true the chart begin with percent mode

	chart.percentMode()
	activate and begin with percent mode

	*/
	chart.percentMode=function(_)
	{
		if(!arguments.length)
		{
			_mode = 'SP'
			return chart
		}
		if(!arguments[0])
			_disabledModes.push('SP')
		if(arguments.length>1 && arguments[1])
			_mode = 'SP'
		return chart
	}

	/*
	stacked mode feature : 
	chart.stackedMode(activate,start=false)
	if activate is false then stacked mode is not used
	if start is true the chart begin with stacked mode

	chart.stackedMode()
	activate and begin with stacked mode

	*/
	chart.stackedMode=function(_)
	{
		if(!arguments.length)
		{
			_mode = 'S'
			return chart
		}
		if(!arguments[0])
			_disabledModes.push('S')
		if(arguments.length>1 && arguments[1])
			_mode = 'S'
		return chart
	}

	/*
	normal mode feature : 
	chart.normalMode(activate,start=false)
	if activate is false then normal mode is not used
	if start is true the chart begin with normal mode

	chart.normalMode()
	activate and begin with normal mode

	*/
	chart.normalMode=function(_)
	{
		if(!arguments.length)
		{
			_mode = 'N'
			return chart
		}
		if(!arguments[0])
			_disabledModes.push('N')
		if(arguments.length>1 && arguments[1])
			_mode = 'N'
		return chart
	}

	/*
	center mode feature : 
	chart.centerMode(activate,start=false)
	if activate is false then center mode is not used
	if start is true the chart begin with center mode

	chart.centerMode()
	activate and begin with center mode

	*/
	chart.centerMode=function(_)
	{
		if(!arguments.length)
		{
			_mode = 'C'
			return chart
		}
		if(!arguments[0])
			_disabledModes.push('C')
		if(arguments.length>1 && arguments[1])
			_mode = 'C'
		return chart
	}

	chart.sort = function(_)
	{
		if(!arguments.length) return _sortV
		_sortV = _
		return chart
	}	

	chart.style = function(_)
	{
		if(!arguments.length) return _style
		
		if(h2d3.styles.hasOwnProperty(_))
			_style=_
		return chart
	}

	chart.tipFunction = function(_)
	{
		if(!arguments.length) return _tipFunction
		
		_tipFunction = _
		return chart	
	}

	chart.updateData = function(data){
		//control same kind of data

		function getOldData(group,serie)
		{
			for (var i = 0; i < mdata.length; i++) {
				if(mdata[i].label==group)
				{
					for (var j = 0; j < mdata[i].series.length; j++) {
						if(mdata[i].series[j].key==serie)
							return mdata[i].series[j].value
					};
					return null
				}
			};
			return null
		}

		function getNewData(group,serie)
		{
			for (var i = 0; i < data.length; i++) {
				if(data[i].key==serie)
				{
					for (var j = 0; j < data[i].values.length; j++) {
						if(data[i].values[j].label==group)
							return data[i].values[j].value
					};
					return null
				}
			};
			return null
		}

		for (var i = 0; i < data.length; i++) {
			for (var j = 0; j < data[i].values.length; j++) {
				var old = getOldData(data[i].values[j].label,data[i].key)
				if(old === null)
				{
					console.error("[h2d3.js] Error : incorrect updateData, item does not exist in previous data :",
						data[i].values[j].label,data[i].key)
					return
				}
			}			
		};
		
		/* set hidden series values to 0 */
		mdata.map(function(g)
		{
			var tot = 0
			g.series.map(function(d)
			{			
				d.value = getNewData(g.label,d.key)	
				if(d.hasOwnProperty('hvalue'))
				{
					d.hvalue = d.value //keep real value in hvalue property
					d.value=0
				}
				tot += d.value
			})
			if(tot==0)
				tot=1;//prevent div#0
			g.total = tot
		})	

		/* re-create cumulatives */
		mdata.forEach(function(d){		
			createCumulatives(d)
		})		

		/* recreate x scales */
		createBarScales()

		/* recreate intra group scale (mode normal) */
		var indexes = d3.range(nseries)
		/* remove indexes from list */
		_hidden.forEach(function(s)
		{
			indexes.splice(indexes.indexOf(serieMap[s].index),1)
		})		
		scales.group_N.domain(indexes)


		/* update data */
		update()

		return chart
	}

	
	/*
		create the control box (change mode feature)
	*/
	var createControls=function(available_modes)
	{
		var mode_data = (available_modes.length>1)? available_modes : []
		svg.append('g')
		.attr('class','h2d3_controls')
		.selectAll('g')
		.data(mode_data)
		.enter().append('g')
		.attr('class','h2d3_ctrl '+_style)
		.style('cursor','pointer')
			.attr('pointer-events','all')
		.attr('transform',function(d,i){return 'translate(0,'+(i*16)+')';})
		.each(function(d,i){
			var g = d3.select(this);
			g.append('circle')
				.attr('class','h2d3_ctrl_circle '+_style)
				.attr('r','5')	
			g.append('circle')
				.attr('class',function()
					{
						if(d==_mode)
							return 'h2d3_ctrl_dot h2d3_ctrl_dot_selected '+_style;
						else
							return 'h2d3_ctrl_dot '+_style;
					})
				.attr('r','2')								
			g.append('text')
				.attr('class','h2d3_ctrl_text')
				.attr('dy','.32em')
				.attr('dx','8')
				.attr('text-anchor','start')
				.text(function(){return h2d3.modeNames[d];})
		})
		.on('click',function(d){
			if(d!=_mode)
			{
				/* unselect old mode radio button */
				var otherControls = d3.select(this.parentNode)
									.selectAll('.h2d3_ctrl_dot_selected')
									.attr('class','h2d3_ctrl_dot '+_style)

				changeMode(d)							

				/* select this radio button */
				d3.select(this).selectAll('.h2d3_ctrl_dot')
						.attr('class','h2d3_ctrl_dot h2d3_ctrl_dot_selected '+_style)
			}
		})

	}

	/*
		create legend
		legend items are button to hide/show series

		need controlsWidth to set size
	*/
	var createLegend=function(series,controlsWidth)
	{
		var legend_margin = 20
		var legend_inter_spacing = 5

		function emptyCircle(circle)
		{
			/* 
			if the color of the series is set by css 
			.h2d3_serie_serie1{
				fill:blue;
			}
			get the fill color to set the stroke color

			This way, the user only needs one css rule to set color on both bars and legend
			*/
			var color = window.getComputedStyle(circle,null).getPropertyValue('fill')
			d3.select(circle)
				.attr('stroke',color)
				.attr('stroke-width','2.5')
				.attr('fill','none')
				.attr('class','h2d3_legend_item_circle')
		}

		function refillCircle(circle)
		{
			var color = window.getComputedStyle(circle,null).getPropertyValue('stroke')
			d3.select(circle)
				.attr('stroke','none')
				.attr('stroke-width','0.5')
				.attr('fill',color)
		}

		svg.append('g')
			.attr('class','h2d3_legend')		
			.selectAll('g')
			.data(series)
			.enter().append('g')
			.attr('class','h2d3_legend_item')
			.style('cursor',(_selectSeries)? 'pointer' : 'auto')
			.attr('pointer-events','all')
			.each(function(d,i){
				var g = d3.select(this);
				g.append('circle')
					.attr('class',function(){return 'h2d3_legend_item_circle h2d3_serie_'+createCSSValidClassName(d);})				
					.attr('fill',function(d){return scales.color(serieMap[d].index);})
					.attr('stroke-width','0.5')
					.attr('stroke','none')
					.attr('r','5')								

				g.append('text')
					.attr('class',function(){return 'h2d3_legend_item_text h2d3_serie_'+createCSSValidClassName(d);})
					.attr('dy','.32em')
					.attr('dx','8')
					.attr('text-anchor','start')
					.attr('fill',function(d){return scales.color(serieMap[d].index);})
					.text(function(){return d;})
					
			})
			.on('click',function(d)
			{					
				if(!_selectSeries)
					return;
				if(_hidden.indexOf(d)==-1)
				{				
					_hidden.push(d)
					hide(_hidden)
					emptyCircle(this.getElementsByClassName('h2d3_legend_item_circle')[0])
				}else{
					
					var idx = _hidden.indexOf(d)
					_hidden.splice(idx,1)
					hide(_hidden)
					refillCircle(this.getElementsByClassName('h2d3_legend_item_circle')[0])
					
				}
			})

		/* all legend items are on the same place so legend_spacing is the max of legend_item's width */
		var legend_spacing = svg.select('.h2d3_legend')[0][0].getBBox().width+legend_inter_spacing

		/* compute number of rows based on legend item's size and available space*/
		var nrows = 1
		while(Math.ceil(nseries/nrows)*legend_spacing > _width -controlsWidth -legend_margin &&
				nrows<nseries)
			nrows++;

		/* move all legend items based of row */
		svg.selectAll('.h2d3_legend_item')		
			.attr('transform',function(d,i){
					return 'translate('+(Math.floor(i/nrows)*legend_spacing)+','+
						((i%nrows)*16)+
						')';
				})
		/* put legend to the top */
		svg.select('.h2d3_legend')		
			.attr('transform',function(d,i){
					return 'translate('+(_width-margin.left-margin.right-
										(legend_spacing*Math.ceil(nseries/nrows)))+',-'+
								nrows*16+')';})			

	}

	var createTip=function()
	{		
		tip = d3tip()
		  .attr('class', 'h2d3-tip '+_style)
		  .offset([-10, 0])
		  .direction('n')
		  .html(_tipFunction)
		if(_vertical)
		{
			// if vertical the rotation cause trouble to compute tooltip's position
			tip.offset(function(d){
				var h = this.getAttribute('height')
				var w = this.getAttribute('width')
				return [-w/2-10,h/2]
			})
		}
		return tip
	}

	/* used to set css classname based on series name*/
	function createCSSValidClassName(str)
	{
		return str.replace(/[^A-Za-z0-9]/g,'-')
	}

	/*
		count and set values for stacked and percent mode
	*/
	function createCumulatives(d)
	{
	  	var cumx = 0
	  	var cumxp = 0
	  	d.series.forEach(function(ds)
	  	{
	  		ds.cumx = cumx;
	  		ds.cumxp = cumxp;

	  		ds.percent = ds.value/d.total
	  		
	  		cumx+=ds.value		  		
	  		cumxp+=ds.percent
	  	})

	}

	/*
		if xLabels are too long, we have to rotate them
	*/
	var rotateXLabels = function(xAxis)
	{
		var xscale = xAxis.scale()

		if(_vertical)
		{
			/* available space */
			var sizePerLabel = xscale.rangeBand()
			var max=0
			svg.select('.h2d3_axis.x')
				.selectAll('text')
				.each(function()
				{
					max = Math.max(this.getBBox().width,max)
				})
			if(max<sizePerLabel)
				return 0;//ok no problem of long labels
			svg.select('.h2d3_axis.x')
				.selectAll('text')
				.style('text-anchor','end')
				.attr('transform','rotate(-30)')
			/* return the new height to change chart margin*/
			return svg.select('.h2d3_axis.x')[0][0].getBBox().height;			
		}
		return 0;
	}

	var createYAxis=function()
	{
		var yAxis = d3.svg.axis()
		var y
		if(_vertical)
		{
			
			/* create Y scale (group scale) */			
			createBarScales()

			/* select y scale depending on mode*/
			y = scales['bar_'+_mode].copy()
			y.range([height,0]) 

			yAxis.tickFormat(tickFormat)
		}else{
			/* create Y scale (group scale) */
			createGroupScales()
			y = scales.group
			
		}
		yAxis.scale(y)
			 .orient('left')

		return yAxis
	}

	var createXAxis=function()
	{
		var xAxis = d3.svg.axis()
		if(_vertical)
		{
			/* create X scales (values) */
			createGroupScales() //read width
			x = scales.group

		}else{//horizontal
			/* create X scales (values) */
			createBarScales() //read width
			
			var x = scales['bar_'+_mode]
			/* change tick format depending on mode*/
			xAxis.tickFormat(tickFormat)			
		}

		xAxis.scale(x)
			 .orient('bottom');
		return xAxis;
	}

	var createGroupScales=function()
	{
		var size = (_vertical)? width : height
		scales.group = d3.scale.ordinal()
			.domain(mdata.map(function(d){return d.label;}))
			.rangeRoundBands([0,size],0.1)

		scales.group_N = d3.scale.ordinal()
			.domain(d3.range(nseries))
			.rangeRoundBands([0,scales.group.rangeBand()])

	}

	var createBarScales=function()
	{
		var size = (_vertical)? height : width
		var xmin = 999999999
		var xmax = -999999999
		var xsumMin = xmin
		var xsumMax = xmax
		mdata.forEach(function(e){
		  var sum = 0;

		  e.series.forEach(function(s,i)
		  {    
		    var v = s.value
		    xmin = Math.min(v,xmin)
		    xmax = Math.max(v,xmax)
		    sum+= v
		    if(serieMap[s.key].total>0)
		      s.norm_value = v/serieMap[s.key].total
		  })
		  e.total = sum
		  xsumMax = Math.max(xsumMax,sum)
		  xsumMin = Math.min(xsumMin,sum)
		})

		

		scales.bar_N = d3.scale.linear()
		    .range([0, size])
		    .domain([Math.min(0,xmin),xmax])

		scales.bar_S = d3.scale.linear()
		    .range([0, size])
		    .domain([0,xsumMax])

		scales.bar_SP = d3.scale.linear()
		    .range([0, size])
		    .domain([0,1])

		scales.bar_C = d3.scale.linear()
		    .range([0, size])
		    .domain([-xmax,xmax])
	}



	drawFunctions.N = function(bar)
	{
		/* mode N : bars side by side */
		var x = scales.bar_N;
		bar
		  .attr('width',function(d){return Math.abs(x(d.value) - x(0));})
		  .attr('height',scales.group_N.rangeBand())
		  .attr('x',function(d){return x(Math.min(0,d.value))})
		  .attr('y',function(d,i){
		  	var y = scales.group_N(serieMap[d.key].index)
		  	if(y!==undefined)
		  		return y 
		  	return this.getAttribute('y')// during transition
		  })		  		
	},
	drawFunctions.S = function(bar)
	{		
		/* mode S : stacked bar */
		var x = scales.bar_S;
		bar
		  .attr('width',function(d){return x(d.value);})
		  .attr('height',scales.group.rangeBand())
		  .attr('x',function(d){return x(d.cumx);})
		  .attr('y',0)
	},
	drawFunctions.SP = function(bar)
	{		
		/* mode SP : percent stacked bar */
		var x = scales.bar_SP;
		bar
		  .attr('width',function(d){return x(d.percent);})
		  .attr('height',scales.group.rangeBand())
		  .attr('x',function(d){return x(d.cumxp);})
		  .attr('y',0)		  
	},
	drawFunctions.C = function(bar)
	{
		/* mode C : compare 2 series */
		var x = scales.bar_C;
		bar
		  .attr('width',function(d){
		  	return x(d.value) - x(0);
		  })
		  .attr('height',scales.group.rangeBand())
		  .attr('x',function(d,i){
		  	return (serieMap[d.key].index%2==0)? x(-d.value) : x(0);
		  })
		  .attr('y',0)		  
	}


	var drawGrid = function(chartContent)
	{
		if(_vertical)
		{
			yAxis.tickSize(-width,0)
			chartContent.select('.h2d3_axis.y')
				.call(yAxis)
		}else{
			xAxis.tickSize(-height,0)
			chartContent.select('.h2d3_axis.x')
				.call(xAxis)
		}
	}


	var hide=function(hidden)
	{
		_hidden = hidden;
		
		/* set hidden series values to 0 */
		mdata.map(function(g)
		{
			var tot = 0
			g.series.map(function(d)
			{
				if(hidden.indexOf(d.key)>-1 && !d.hasOwnProperty('hvalue'))
				{
					d.hvalue = d.value //keep real value in hvalue property
					d.value=0
				}else if(hidden.indexOf(d.key)==-1 && d.hasOwnProperty('hvalue'))
				{
					d.value = d.hvalue
					delete d.hvalue
				}
				tot += d.value
			})
			if(tot==0)
				tot=1;//prevent div#0
			g.total = tot
		})	


		/* re-create cumulatives */
		mdata.forEach(function(d){		
			createCumulatives(d)
		})		

		/* recreate x scales */
		createBarScales()

		/* recreate intra group scale (mode normal) */
		var indexes = d3.range(nseries)
		/* remove indexes from list */
		_hidden.forEach(function(s)
		{
			indexes.splice(indexes.indexOf(serieMap[s].index),1)
		})		
		scales.group_N.domain(indexes)


		/* update data */
		update()

	}

	var changeMode=function(mode)
	{
		if(_mode==mode)
			return;
		_mode = mode
		update()
	}

	var update=function()
	{
		

		var transition = svg.transition().duration(500)	
		var barScale = scales['bar_'+_mode]

		if(_vertical)
		{
			barScale = barScale.copy()
			barScale.range([height,0]) 
		}

		var barAxis = (_vertical? yAxis : xAxis)
				    
		barAxis.scale(barScale)
			   

		tickFormat = _tickFormat
		if(_mode=='SP')
			tickFormat = d3.format('.2p')
		else if(_mode=='C')
			tickFormat = function(n){return _tickFormat(Math.abs(n))}
		
		barAxis.tickFormat(tickFormat)

		transition.select((_vertical)? '.y.h2d3_axis' : '.x.h2d3_axis')
					.call(barAxis)
		
		var drawFunction = drawFunctions[_mode]
		transition.selectAll('.h2d3_group rect.h2d3_bar')	
			.call(drawFunction)


	}

	/*
		sort chart (groups) based on a serie's value

		todo : rename to orderBy ? 

		@param sortV : if empty string : sort by initial index
					   if key of a serie : sort by this serie's value in ascending order
					   if sortV begins with '-' char : descending order
	*/
	var sort=function(sortV)
	{
					
		if(sortV=='' || sortV[0]!='-')
		{
			descending = 1;
		}else{
			var descending = -1;
			sortV = sortV.slice(1);		
		}		

		if(sortV=='')
		{
			/* sort as initial data*/
			for(var k in serieMap)
			{
				if(serieMap.hasOwnProperty(k))
				{				
					serieMap[k].index = serieMap[k].initial;							
				}
			}
			/* sort series */
			mdata.forEach(function(d){
				d.series.sort(function(a,b)
				{
			  		return serieMap[a.key].index - serieMap[b.key].index;
				})
				createCumulatives(d)
			})

			/* sort groups */
			mdata.sort(function(a,b)
			{
				return (a.initial - b.initial)
			})

		}
		else{
			/* sort on a key */

			//swap first with first by new sort key
			var oldIndex = -1
			var oldFirst = null
			for(var k in serieMap)
			{
				if(serieMap.hasOwnProperty(k))
				{
					if(serieMap[k].index==0)
						oldFirst = serieMap[k]
					if(k==sortV)
					{
						oldIndex = serieMap[k].index
						serieMap[k].index = 0
					}			
				}
			}
			if(oldIndex==-1)
				console.error('serie not found : ',sortV)
			if(oldFirst!=null) 
				oldFirst.index = oldIndex;//swap index

			mdata.forEach(function(d){
				d.series.sort(function(a,b)
				{
			  		return serieMap[a.key].index - serieMap[b.key].index;
				})
				createCumulatives(d)
			})

			/* if percent mode we have to sort on percent instead of value*/
			var sortKey = (_mode=='SP') ? 
							'percent' :
							'value'	

			mdata.sort(function(a,b)
			{
				var va = (a.series[0].key==sortV) ?
							a.series[0][sortKey] :
							0;
				var vb = (b.series[0].key==sortV) ?
							b.series[0][sortKey] :
							0;
				return descending * (va - vb)
			})

		}

		/* the group axis change too */
		scales.group = scales.group.domain(mdata.map(function(d){
														return d.label;
													}))
						 			.copy()
		var barAxis = (_vertical ? xAxis : yAxis)
						.scale(scales.group)
		
		var transition = svg.transition().duration(500)
		transition.select(_vertical ? '.h2d3_axis.x' : '.h2d3_axis.y')
				.delay(500)
				.call(barAxis)					
		if(hasRotateXLabels)
		{
			/* fix: transition reset text-anchor */
			svg.select('.h2d3_axis.x')
				.selectAll('text')
				.style('text-anchor','end')
		}

		transition.selectAll('.h2d3_group')
			  .attr('transform',function(d){return 'translate(0,'+scales.group(d.label)+')';})
			  .delay(500)

		var drawFunction = drawFunctions[_mode]
		transition.selectAll('.h2d3_group rect.h2d3_bar')	
			.call(drawFunction)


	};	

	var preprocessData = function(data)
	{
		var dictData = {}
		var matrixData = []
		var groupnames = []

		data.forEach(function(s,i)
		{  
		  var serieObj = {
		      key:s.key,
		      index:i,
		      initial:i
		    }

		  
		  var sum = 0
		  s.values.forEach(function(g,i){
		    if(!dictData.hasOwnProperty(g.label))
		    {
		    	var initial_index = matrixData.length
		   		dictData[g.label] = {label:g.label,series:[],initial:initial_index}
		    	matrixData.push(dictData[g.label])	    	
		    }
		    dictData[g.label].series.push({key:s.key,value:g.value})
		    sum += g.value;
		    if(g.value<0)
		      hasNegValue = true;	  	
		  })
		  if(sum==0)
		    sum=1//prevent div#0
		  
		  serieObj.total=sum
		  serieMap[s.key] = serieObj;	
		})

		dictData = null;

		console.log(matrixData)
		return matrixData;
	}

	return chart;
};


return h2d3;
}

));
