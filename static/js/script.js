document.addEventListener('DOMContentLoaded', function() {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('file-list');
    const columnSelectionCard = document.getElementById('column-selection-card');
    const columnSelection = document.getElementById('column-selection');
    const analyzeBtn = document.getElementById('analyze-btn');
    const previewSection = document.getElementById('preview-section');
    const statsSection = document.getElementById('stats-section');
    const visualizationSection = document.getElementById('visualization-section');
    
    let uploadedFiles = [];
    let allColumns = new Set();
    let selectedColumns = [];
    
    // Drag and drop functionality
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropArea.classList.add('highlight');
    }
    
    function unhighlight() {
        dropArea.classList.remove('highlight');
    }
    
    dropArea.addEventListener('drop', handleDrop, false);
    fileInput.addEventListener('change', handleFiles, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles({ target: { files } });
    }
    
    function handleFiles(e) {
        const files = e.target.files;
        if (files.length === 0) return;
        
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            if (!files[i].name.toLowerCase().endsWith('.csv')) {
                alert('Only CSV files are allowed');
                return;
            }
            formData.append('files[]', files[i]);
        }
        
        uploadFiles(formData);
    }
    
    function uploadFiles(formData) {
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }
            
            uploadedFiles = data.files;
            displayFileList();
            displayPreviews();
            setupColumnSelection();
            
            previewSection.style.display = 'block';
            columnSelectionCard.style.display = 'block';
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error uploading files');
        });
    }
    
    function displayFileList() {
        fileList.innerHTML = '';
        uploadedFiles.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item mb-2 p-2 border rounded';
            fileItem.innerHTML = `
                <div class="d-flex justify-content-between">
                    <span>${file.filename}</span>
                    <span class="badge bg-primary">${file.shape[0]} rows × ${file.shape[1]} cols</span>
                </div>
                <div class="mt-2">
                    <small class="text-muted">Missing values: ${Object.values(file.missing_values).filter(v => v > 0).length} columns</small>
                </div>
            `;
            fileList.appendChild(fileItem);
        });
    }
    
    function displayPreviews() {
        const tabsNav = document.getElementById('preview-tabs');
        const tabsContent = document.getElementById('preview-tab-content');
        
        tabsNav.innerHTML = '';
        tabsContent.innerHTML = '';
        
        uploadedFiles.forEach((file, index) => {
            const tabId = `preview-tab-${index}`;
            const contentId = `preview-content-${index}`;
            
            // Create tab nav item
            const navItem = document.createElement('li');
            navItem.className = 'nav-item';
            navItem.innerHTML = `
                <a class="nav-link ${index === 0 ? 'active' : ''}" id="${tabId}-tab" data-bs-toggle="tab" 
                   href="#${contentId}" role="tab" aria-controls="${contentId}" aria-selected="${index === 0}">
                    ${file.filename}
                </a>
            `;
            tabsNav.appendChild(navItem);
            
            // Create tab content
            const tabContent = document.createElement('div');
            tabContent.className = `tab-pane fade ${index === 0 ? 'show active' : ''}`;
            tabContent.id = contentId;
            tabContent.role = 'tabpanel';
            tabContent.setAttribute('aria-labelledby', `${tabId}-tab`);
            
            // Create table for preview
            const table = document.createElement('table');
            table.className = 'table table-striped table-bordered table-hover';
            
            // Create table header
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            file.columns.forEach(col => {
                const th = document.createElement('th');
                th.textContent = col;
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);
            
            // Create table body
            const tbody = document.createElement('tbody');
            file.preview.forEach(row => {
                const tr = document.createElement('tr');
                file.columns.forEach(col => {
                    const td = document.createElement('td');
                    td.textContent = row[col] === 'NaN' ? 'N/A' : row[col];
                    if (row[col] === 'NaN') td.classList.add('text-danger');
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            
            tabContent.appendChild(table);
            tabsContent.appendChild(tabContent);
        });
    }
    
    function setupColumnSelection() {
        columnSelection.innerHTML = '';
        allColumns = new Set();
        
        // Collect all unique columns from all files
        uploadedFiles.forEach(file => {
            file.columns.forEach(col => allColumns.add(col));
        });
        
        // Create checkboxes for each column
        Array.from(allColumns).forEach(col => {
            const div = document.createElement('div');
            div.className = 'form-check';
            div.innerHTML = `
                <input class="form-check-input" type="checkbox" value="${col}" id="col-${col}">
                <label class="form-check-label" for="col-${col}">
                    ${col}
                </label>
            `;
            columnSelection.appendChild(div);
        });
        
        // Set up analyze button
        analyzeBtn.onclick = analyzeData;
    }
    
    function analyzeData() {
        selectedColumns = Array.from(document.querySelectorAll('#column-selection input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value);
        
        if (selectedColumns.length === 0) {
            alert('Please select at least one column');
            return;
        }
        
        const selectedFilenames = uploadedFiles.map(file => file.filename);
        
        fetch('/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                files: selectedFilenames,
                columns: selectedColumns
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }
            
            displayStatistics(data);
            displayVisualizations(data);
            
            statsSection.style.display = 'block';
            visualizationSection.style.display = 'flex';
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error analyzing data');
        });
    }
    
    function displayStatistics(data) {
        const statsTable = document.getElementById('stats-table');
        const thead = statsTable.querySelector('thead');
        const tbody = statsTable.querySelector('tbody');
        
        thead.innerHTML = '';
        tbody.innerHTML = '';
        
        // Create header row
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = '<th>Statistic</th>';
        data.numeric_cols.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        
        // Add rows for each statistic
        const stats = ['mean', 'median', 'std', 'min', 'max'];
        stats.forEach(stat => {
            const row = document.createElement('tr');
            const statNameCell = document.createElement('td');
            statNameCell.textContent = stat.charAt(0).toUpperCase() + stat.slice(1);
            row.appendChild(statNameCell);
            
            data.numeric_cols.forEach(col => {
                const cell = document.createElement('td');
                cell.textContent = data.stats[col][stat].toFixed(2);
                row.appendChild(cell);
            });
            
            tbody.appendChild(row);
        });
    }
    
    function displayVisualizations(data) {
        // Setup dropdowns
        const histogramSelect = document.getElementById('histogram-select');
        const scatterX = document.getElementById('scatter-x');
        const scatterY = document.getElementById('scatter-y');
        const barchartSelect = document.getElementById('barchart-select');
        const piechartSelect = document.getElementById('piechart-select');
        
        histogramSelect.innerHTML = '';
        scatterX.innerHTML = '';
        scatterY.innerHTML = '';
        barchartSelect.innerHTML = '';
        piechartSelect.innerHTML = '';
        
        // Populate dropdowns
        data.numeric_cols.forEach(col => {
            const option1 = document.createElement('option');
            option1.value = col;
            option1.textContent = col;
            histogramSelect.appendChild(option1.cloneNode(true));
            
            const option2 = document.createElement('option');
            option2.value = col;
            option2.textContent = col;
            scatterX.appendChild(option2.cloneNode(true));
            
            const option3 = document.createElement('option');
            option3.value = col;
            option3.textContent = col;
            scatterY.appendChild(option3.cloneNode(true));
        });
        
        data.cat_cols.forEach(col => {
            const option1 = document.createElement('option');
            option1.value = col;
            option1.textContent = col;
            barchartSelect.appendChild(option1.cloneNode(true));
            
            const option2 = document.createElement('option');
            option2.value = col;
            option2.textContent = col;
            piechartSelect.appendChild(option2.cloneNode(true));
        });
        
        // Create heatmap
        createHeatmap(data.correlation, data.numeric_cols);
        
        // Create initial charts
        if (data.numeric_cols.length > 0) {
            createHistogram(data.distributions[data.numeric_cols[0]]);
            createScatterPlot(data.numeric_cols[0], data.numeric_cols[Math.min(1, data.numeric_cols.length - 1)]);
        }
        
        if (data.cat_cols.length > 0) {
            createBarChart(data.categorical[data.cat_cols[0]].counts);
            createPieChart(data.categorical[data.cat_cols[0]].proportions);
        }
        
        // Set up event listeners
        histogramSelect.addEventListener('change', function() {
            createHistogram(data.distributions[this.value]);
        });
        
        scatterX.addEventListener('change', function() {
            createScatterPlot(this.value, scatterY.value);
        });
        
        scatterY.addEventListener('change', function() {
            createScatterPlot(scatterX.value, this.value);
        });
        
        barchartSelect.addEventListener('change', function() {
            createBarChart(data.categorical[this.value].counts);
        });
        
        piechartSelect.addEventListener('change', function() {
            createPieChart(data.categorical[this.value].proportions);
        });
    }
    
    function createHeatmap(correlationData, columns) {
        const heatmapContainer = document.getElementById('heatmap-container');
        
        const data = {
            z: columns.map(col1 => columns.map(col2 => correlationData[col1][col2])),
            x: columns,
            y: columns,
            type: 'heatmap',
            colorscale: 'Viridis',
            zmin: -1,
            zmax: 1
        };
        
        const layout = {
            title: 'Correlation Matrix',
            annotations: [],
            xaxis: { side: 'bottom' },
            yaxis: { autorange: 'reversed' },
            margin: { t: 50, l: 100 }
        };
        
        // Add annotations
        for (let i = 0; i < columns.length; i++) {
            for (let j = 0; j < columns.length; j++) {
                const result = {
                    x: columns[j],
                    y: columns[i],
                    text: correlationData[columns[i]][columns[j]].toFixed(2),
                    font: {
                        color: Math.abs(correlationData[columns[i]][columns[j]]) > 0.5 ? 'white' : 'black'
                    },
                    showarrow: false
                };
                layout.annotations.push(result);
            }
        }
        
        Plotly.newPlot(heatmapContainer, [data], layout);
    }
    
    function createHistogram(distribution) {
        const histogramContainer = document.getElementById('histogram-container');
        
        const data = [{
            x: distribution.bins,
            y: distribution.hist,
            type: 'bar',
            marker: {
                color: 'rgba(55, 128, 191, 0.7)',
                line: {
                    color: 'rgba(55, 128, 191, 1)',
                    width: 1
                }
            }
        }];
        
        const layout = {
            title: 'Distribution',
            bargap: 0.05,
            xaxis: { title: 'Value' },
            yaxis: { title: 'Frequency' }
        };
        
        Plotly.newPlot(histogramContainer, data, layout);
    }
    
    function createScatterPlot(xCol, yCol) {
        const scatterContainer = document.getElementById('scatter-container');
        
        // For demo purposes, we'll create random data
        // In a real app, you would use the actual data from your analysis
        const trace = {
            x: Array.from({ length: 100 }, () => Math.random() * 10),
            y: Array.from({ length: 100 }, () => Math.random() * 10),
            mode: 'markers',
            type: 'scatter',
            marker: {
                size: 12,
                color: 'rgba(156, 165, 196, 0.8)',
                line: {
                    width: 1,
                    color: 'rgba(156, 165, 196, 1)'
                }
            }
        };
        
        const layout = {
            title: `${xCol} vs ${yCol}`,
            xaxis: { title: xCol },
            yaxis: { title: yCol },
            hovermode: 'closest'
        };
        
        Plotly.newPlot(scatterContainer, [trace], layout);
    }
    
    function createBarChart(counts) {
        const barchartContainer = document.getElementById('barchart-container');
        
        const categories = Object.keys(counts);
        const values = Object.values(counts);
        
        const data = [{
            x: categories,
            y: values,
            type: 'bar',
            marker: {
                color: 'rgba(75, 192, 192, 0.7)',
                line: {
                    color: 'rgba(75, 192, 192, 1)',
                    width: 1
                }
            }
        }];
        
        const layout = {
            title: 'Category Counts',
            xaxis: { title: 'Category' },
            yaxis: { title: 'Count' }
        };
        
        Plotly.newPlot(barchartContainer, data, layout);
    }
    
    function createPieChart(proportions) {
        const piechartContainer = document.getElementById('piechart-container');
        
        const labels = Object.keys(proportions);
        const values = Object.values(proportions);
        
        const data = [{
            labels: labels,
            values: values,
            type: 'pie',
            textinfo: 'label+percent',
            hoverinfo: 'label+percent+value',
            marker: {
                colors: [
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(153, 102, 255, 0.7)',
                    'rgba(255, 159, 64, 0.7)'
                ]
            }
        }];
        
        const layout = {
            title: 'Category Proportions',
            showlegend: true
        };
        
        Plotly.newPlot(piechartContainer, data, layout);
    }
});
