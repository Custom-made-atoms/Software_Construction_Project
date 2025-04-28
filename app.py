from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
import io
import os
import sqlite3
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize SQLite database
def init_db():
    conn = sqlite3.connect('data_analysis.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS uploads
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  filename TEXT,
                  upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    conn.commit()
    conn.close()

init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_files():
    if 'files[]' not in request.files:
        return jsonify({'error': 'No files uploaded'}), 400
    
    files = request.files.getlist('files[]')
    results = []
    
    for file in files:
        if file.filename == '':
            continue
        
        if not file.filename.lower().endswith('.csv'):
            return jsonify({'error': 'Only CSV files are allowed'}), 400
        
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        try:
            # Read CSV and get preview
            df = pd.read_csv(filepath)
            preview = df.head(10).fillna('NaN').to_dict('records')
            
            # Store file info in database
            conn = sqlite3.connect('data_analysis.db')
            c = conn.cursor()
            c.execute("INSERT INTO uploads (filename) VALUES (?)", (filename,))
            conn.commit()
            conn.close()
            
            results.append({
                'filename': filename,
                'columns': list(df.columns),
                'preview': preview,
                'shape': df.shape,
                'missing_values': df.isnull().sum().to_dict()
            })
        except Exception as e:
            return jsonify({'error': f'Error processing {filename}: {str(e)}'}), 400
    
    return jsonify({'files': results})

@app.route('/analyze', methods=['POST'])
def analyze_data():
    data = request.json
    selected_files = data.get('files', [])
    selected_columns = data.get('columns', [])
    
    if not selected_files or not selected_columns:
        return jsonify({'error': 'No files or columns selected'}), 400
    
    try:
        # Load and combine selected data
        dfs = []
        for filename in selected_files:
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            df = pd.read_csv(filepath)
            dfs.append(df[selected_columns])
        
        combined_df = pd.concat(dfs, ignore_index=True)
        
        # Calculate statistics
        numeric_cols = combined_df.select_dtypes(include=[np.number]).columns.tolist()
        stats = {}
        
        for col in numeric_cols:
            stats[col] = {
                'mean': combined_df[col].mean(),
                'median': combined_df[col].median(),
                'std': combined_df[col].std(),
                'min': combined_df[col].min(),
                'max': combined_df[col].max()
            }
        
        # Calculate correlation matrix
        correlation = combined_df[numeric_cols].corr().round(2).to_dict()
        
        # Generate distribution data for histograms
        distributions = {}
        for col in numeric_cols:
            hist, bins = np.histogram(combined_df[col].dropna(), bins=10)
            distributions[col] = {
                'hist': hist.tolist(),
                'bins': bins.tolist()
            }
        
        # Prepare categorical data
        cat_cols = combined_df.select_dtypes(exclude=[np.number]).columns.tolist()
        categorical = {}
        
        for col in cat_cols:
            counts = combined_df[col].value_counts().to_dict()
            categorical[col] = {
                'counts': counts,
                'proportions': {k: v/len(combined_df) for k, v in counts.items()}
            }
        
        return jsonify({
            'stats': stats,
            'correlation': correlation,
            'distributions': distributions,
            'categorical': categorical,
            'numeric_cols': numeric_cols,
            'cat_cols': cat_cols
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)
