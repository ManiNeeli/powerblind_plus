# Google Colab Execution Guide for PowerBlind+

This guide walks you through running **PowerBlind+** in [Google Colab](https://colab.research.google.com). Google Colab provides free cloud compute (including T4 GPUs and high-RAM instances) to train the XGBoost anomaly detection model, compute SHAP explainability values, and test live predictions without local hardware requirements.

---

## What Can You Run in Google Colab?

1. **Dataset Generation & Inspection**: Generate or verify the 1.825M smart meter dataset (5,000 consumers × 365 days).
2. **Feature Engineering**: Compute 26 statistical, electrical, and temporal features per consumer.
3. **Model Training with SMOTE**: Run 5-fold Stratified Cross Validation and train the multi-class XGBoost anomaly detector (`Normal`, `Theft`, `FaultyMeter`, `CommFailure`).
4. **Model Evaluation**: Generate classification metrics and confusion matrix heatmaps.
5. **SHAP Explainability**: Calculate TreeExplainer SHAP values to identify key features driving each anomaly class.
6. **Diagnostic Waterfall Charts**: Plot feature contribution graphs for individual consumers explaining *why* an anomaly was flagged.
7. **Artifact Export**: Export `model_latest.joblib`, `metrics.json`, and `shap.json` in a single downloadable `.zip`.
8. **Interactive In-Notebook Testing**: Use an interactive widget inside Colab to diagnose any consumer in real time.
9. **Live FastAPI Server**: Run the ML microservice in Colab and test inference endpoints.

---

## Quick Start: How to Run in Google Colab

### Method 1: Upload `powerblind-plus.zip` + Notebook (Recommended)

1. Open [Google Colab](https://colab.research.google.com).
2. Click **File** → **Upload notebook** → select `colab_powerblind_plus.ipynb` from your folder.
3. In Colab's left sidebar, click the **Files (folder) icon** 📁.
4. Click the **Upload to session storage** button (or drag and drop) and select **`powerblind-plus.zip`** (located at `d:\manijava\powerblind-plus\powerblind-plus.zip`).
5. *(Recommended)* Enable GPU:
   - Click **Runtime** → **Change runtime type** → select **T4 GPU** → click **Save**.
6. Click **Runtime** → **Run all** (`Ctrl + F9`).
   - The notebook **automatically detects and unzips `powerblind-plus.zip`**!
   - It automatically loads the dataset (from `data/` or `PowerBlind_Plus_Dataset/`), engineers 26 features, trains the multi-class XGBoost model with SMOTE & 5-fold CV, renders confusion matrices & SHAP waterfall charts, and automatically triggers the download of `powerblind_models.zip`!

---

### Method 2: Upload the `.ipynb` Notebook Directly (Standalone Generation)

1. Go to [Google Colab](https://colab.research.google.com).
2. Click **File** → **Upload notebook** → select `colab_powerblind_plus.ipynb`.
3. Click **Runtime** → **Run all**.
4. If no dataset is uploaded, the notebook will automatically generate the synthetic dataset on the fly (~1-2 minutes) and proceed with training!

---

### Method 3: Upload Project to Google Drive

1. Compress your `powerblind-plus` project folder into a zip file, or copy it to Google Drive.
2. Open Google Colab and mount Google Drive in the first cell:
   ```python
   from google.colab import drive
   drive.mount('/content/drive')
   ```
3. Copy or extract your project:
   ```bash
   !cp -r /content/drive/MyDrive/powerblind-plus /content/powerblind-plus
   %cd /content/powerblind-plus
   ```
4. Open and run `colab_powerblind_plus.ipynb`.

---

### Method 3: Clone from Git Repository

If your project is pushed to GitHub:
1. Open a new notebook in Google Colab.
2. Clone the repository:
   ```bash
   !git clone <YOUR_GITHUB_REPO_URL> powerblind-plus
   %cd powerblind-plus
   ```
3. Open `colab_powerblind_plus.ipynb` in Colab.

---

## Detailed Notebook Workflow

```
┌───────────────────────────────────────────────────────────┐
│ 1. Hardware & Environment Verification                   │
│    Detects GPU / CPU and Python environment               │
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│ 2. Install ML Dependencies                                │
│    xgboost, shap, scikit-learn, imbalanced-learn, fastapi │
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│ 3. Dataset Setup & Feature Engineering                    │
│    5,000 consumers × 365 readings → 26 engineered features│
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│ 4. XGBoost Training + SMOTE + 5-Fold Cross Validation     │
│    Balances minority classes & trains multi-class model   │
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│ 5. SHAP TreeExplainer & Visualizations                    │
│    Global importance + local waterfall contribution charts│
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│ 6. Export Model Archive (`powerblind_models.zip`)         │
│    Downloadable model_latest.joblib, metrics.json, shap   │
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│ 7. Interactive Diagnostic Widget & Live FastAPI Server     │
│    Real-time inference inside Colab                       │
└───────────────────────────────────────────────────────────┘
```

---

## How to Bring Trained Models Back to Your Local Project

After running the training in Colab, the notebook generates `powerblind_models.zip` containing:
- `model_latest.joblib`
- `metrics.json`
- `shap.json`

To use these models on your local machine:
1. Download `powerblind_models.zip` from Colab (it downloads automatically, or you can download it from the Colab file browser sidebar on the left).
2. Extract the files into your local project at:
   ```
   powerblind-plus/services/ml/models/
   ```
   Specifically:
   ```
   powerblind-plus/services/ml/models/model_latest.joblib
   powerblind-plus/services/ml/models/metrics_latest.json
   powerblind-plus/services/ml/models/shap_latest.json
   ```
3. Start the local ML service:
   ```bash
   cd services/ml
   python main.py
   ```
4. The service will automatically detect `model_latest.joblib` and switch from `MOCK` mode to `XGBOOST` mode!
5. In your web application ([http://localhost:5173](http://localhost:5173)), navigate to **Admin → Model Health** to view the live trained model version, confusion matrix, and performance metrics!

---

## Troubleshooting Colab Runs

- **Colab Session Disconnects during Training**: Colab free tier sessions stay active as long as the tab is open. If your browser sleeps, click on the notebook tab occasionally.
- **Dataset Generation Time**: Generating 1.8M rows takes ~1–2 minutes in Colab. If you already generated `data/powerblind_smartmeter_readings.csv` locally, you can upload it directly into the `data/` folder in Colab to skip regeneration.
- **Memory Usage**: Colab Free Tier provides 12 GB RAM, which easily accommodates the full 5,000 consumers and 1.825M readings.
