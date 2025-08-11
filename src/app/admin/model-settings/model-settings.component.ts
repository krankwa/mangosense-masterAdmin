import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MangoDiseaseService, MangoImage } from '../../services/mango-disease.service';

interface ModelStats {
  accuracy: number;
  trainingDataCount: number;
  lastUpdated: string;
  version: string;
  status: 'active' | 'training' | 'pending' | 'error';
  totalPredictions: number;
}

interface TrainingDataSources {
  verifiedImages: MangoImage[];
  unverifiedImages: MangoImage[];
  totalVerified: number;
  totalUnverified: number;
  byDiseaseType: { [key: string]: number };
  byImageType: {
    leaf: number;
    fruit: number;
  };
}

interface RetrainingConfig {
  epochs: number;
  batchSize: number;
  learningRate: number;
  validationSplit: number;
  includeUnverified: boolean;
  minImagesPerClass: number;
  augmentData: boolean;
  balanceClasses: boolean;
}

interface TrainingProgress {
  currentEpoch: number;
  totalEpochs: number;
  currentLoss: number;
  currentAccuracy: number;
  validationAccuracy: number;
  estimatedTimeRemaining: string;
  status: 'preparing' | 'training' | 'validating' | 'completed' | 'error';
  currentPhase: string;
  processedImages: number;
  totalImages: number;
}

@Component({
  selector: 'app-model-settings',
  templateUrl: './model-settings.component.html',
  styleUrls: ['./model-settings.component.css'],
  standalone: false
})
export class ModelSettingsComponent implements OnInit {
  
  modelStats: ModelStats = {
    accuracy: 0,
    trainingDataCount: 0,
    lastUpdated: '',
    version: 'v1.0.0',
    status: 'active',
    totalPredictions: 0
  };

  trainingDataSources: TrainingDataSources = {
    verifiedImages: [],
    unverifiedImages: [],
    totalVerified: 0,
    totalUnverified: 0,
    byDiseaseType: {},
    byImageType: {
      leaf: 0,
      fruit: 0
    }
  };

  retrainingConfig: RetrainingConfig = {
    epochs: 50,
    batchSize: 32,
    learningRate: 0.001,
    validationSplit: 0.2,
    includeUnverified: false,
    minImagesPerClass: 20,
    augmentData: true,
    balanceClasses: true
  };

  trainingProgress: TrainingProgress | null = null;
  isRetraining = false;
  error: string | null = null;
  loading = false;

  // Available disease classes in your system
  diseaseCategories = [
    'Anthracnose', 'Bacterial Canker', 'Die Back', 'Gall Midge',
    'Powdery Mildew', 'Sooty Mold', 'Black Mold Rot', 'Stem End Rot', 'Healthy'
  ];

  constructor(
    private router: Router,
    private mangoDiseaseService: MangoDiseaseService
  ) {}

  ngOnInit() {
    this.loadModelData();
  }

  // Add method to expose Object.keys to template
  getObjectKeys(obj: any): string[] {
    return Object.keys(obj);
  }

  async loadModelData() {
    this.loading = true;
    this.error = null;

    try {
      // Load all data concurrently
      await Promise.all([
        this.loadVerifiedImages(),
        this.loadUnverifiedImages(),
        this.loadModelStats()
      ]);

      // Process and categorize the loaded data
      this.processTrainingData();
      
    } catch (error) {
      console.error('Error loading model data:', error);
      this.error = 'Failed to load training data from database';
    } finally {
      this.loading = false;
    }
  }

  private async loadVerifiedImages() {
    try {
      // Fetch verified images from database
      const response = await this.mangoDiseaseService.getImages({ 
        verified: true,
        limit: 10000 // Get all verified images
      }).toPromise();

      if (response?.success) {
        this.trainingDataSources.verifiedImages = response.data;
        this.trainingDataSources.totalVerified = response.data.length;
        
        console.log(`Loaded ${this.trainingDataSources.totalVerified} verified images from database`);
      } else {
        throw new Error('Failed to fetch verified images');
      }
    } catch (error) {
      console.error('Error loading verified images:', error);
      throw error;
    }
  }

  private async loadUnverifiedImages() {
    try {
      // Fetch unverified images from database
      const response = await this.mangoDiseaseService.getImages({ 
        verified: false,
        limit: 10000 // Get all unverified images
      }).toPromise();

      if (response?.success) {
        this.trainingDataSources.unverifiedImages = response.data;
        this.trainingDataSources.totalUnverified = response.data.length;
        
        console.log(`Loaded ${this.trainingDataSources.totalUnverified} unverified images from database`);
      } else {
        throw new Error('Failed to fetch unverified images');
      }
    } catch (error) {
      console.error('Error loading unverified images:', error);
      throw error;
    }
  }

  private async loadModelStats() {
    try {
      // Load current model statistics
      const stats = await this.mangoDiseaseService.getDiseaseStatistics().toPromise();
      
      if (stats) {
        this.modelStats = {
          accuracy: 94.5, // You might want to store this in your database
          trainingDataCount: stats.total_images || 0,
          lastUpdated: new Date().toLocaleDateString(),
          version: 'v1.2.3', // You might want to store this in your database
          status: 'active',
          totalPredictions: stats.total_images || 0
        };
      }
    } catch (error) {
      console.error('Error loading model stats:', error);
      // Use default values if stats loading fails
    }
  }

  private processTrainingData() {
    // Reset counters
    this.trainingDataSources.byDiseaseType = {};
    this.trainingDataSources.byImageType = { leaf: 0, fruit: 0 };

    // Process verified images
    this.trainingDataSources.verifiedImages.forEach(image => {
      // Count by disease type
      const diseaseClass = image.predicted_class || 'Unknown';
      this.trainingDataSources.byDiseaseType[diseaseClass] = 
        (this.trainingDataSources.byDiseaseType[diseaseClass] || 0) + 1;

      // Count by image type (check for different possible property names)
      const imageType = this.getImageType(image);
      if (imageType === 'leaf') {
        this.trainingDataSources.byImageType.leaf++;
      } else if (imageType === 'fruit') {
        this.trainingDataSources.byImageType.fruit++;
      }
    });

    // If including unverified images, process them too
    if (this.retrainingConfig.includeUnverified) {
      this.trainingDataSources.unverifiedImages.forEach(image => {
        const diseaseClass = image.predicted_class || 'Unknown';
        this.trainingDataSources.byDiseaseType[diseaseClass] = 
          (this.trainingDataSources.byDiseaseType[diseaseClass] || 0) + 1;

        const imageType = this.getImageType(image);
        if (imageType === 'leaf') {
          this.trainingDataSources.byImageType.leaf++;
        } else if (imageType === 'fruit') {
          this.trainingDataSources.byImageType.fruit++;
        }
      });
    }

    console.log('Training data processed:', {
      byDiseaseType: this.trainingDataSources.byDiseaseType,
      byImageType: this.trainingDataSources.byImageType,
      totalVerified: this.trainingDataSources.totalVerified,
      totalUnverified: this.trainingDataSources.totalUnverified
    });
  }

  // Helper method to get image type (handle different property names)
  private getImageType(image: MangoImage): 'leaf' | 'fruit' | 'unknown' {
    // Check for different possible property names
    if ('image_type' in image && image.image_type) {
      return image.image_type as 'leaf' | 'fruit';
    }
    
    // If no image_type property, try to infer from predicted_class
    const predictedClass = image.predicted_class?.toLowerCase() || '';
    
    // Define leaf diseases
    const leafDiseases = ['anthracnose', 'bacterial canker', 'die back', 'gall midge', 'powdery mildew', 'sooty mold'];
    // Define fruit diseases  
    const fruitDiseases = ['black mold rot', 'stem end rot'];
    
    if (leafDiseases.some(disease => predictedClass.includes(disease))) {
      return 'leaf';
    } else if (fruitDiseases.some(disease => predictedClass.includes(disease))) {
      return 'fruit';
    }
    
    return 'unknown';
  }

  getTotalAvailableImages(): number {
    let total = this.trainingDataSources.totalVerified;
    
    if (this.retrainingConfig.includeUnverified) {
      total += this.trainingDataSources.totalUnverified;
    }
    
    return total;
  }

  getImagesByDiseaseClass(): Array<{disease: string, count: number, percentage: number}> {
    const total = this.getTotalAvailableImages();
    
    return Object.entries(this.trainingDataSources.byDiseaseType)
      .map(([disease, count]) => ({
        disease,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);
  }

  validateTrainingData(): { isValid: boolean; message: string; warnings: string[] } {
    const total = this.getTotalAvailableImages();
    const warnings: string[] = [];

    // Check minimum total images
    if (total < 100) {
      return {
        isValid: false,
        message: `Insufficient training data. Found ${total} images, need at least 100.`,
        warnings
      };
    }

    // Check minimum images per class
    const diseaseBreakdown = this.trainingDataSources.byDiseaseType;
    const insufficientClasses: string[] = [];

    for (const [disease, count] of Object.entries(diseaseBreakdown)) {
      if (count < this.retrainingConfig.minImagesPerClass) {
        insufficientClasses.push(`${disease}: ${count} images`);
      }
    }

    if (insufficientClasses.length > 0) {
      return {
        isValid: false,
        message: `Insufficient images for some disease classes. Need at least ${this.retrainingConfig.minImagesPerClass} per class.`,
        warnings: insufficientClasses
      };
    }

    // Check for class imbalance
    const counts = Object.values(diseaseBreakdown);
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    
    if (maxCount > minCount * 3) {
      warnings.push('Significant class imbalance detected. Consider enabling class balancing.');
    }

    // Check if unverified images are included
    if (this.retrainingConfig.includeUnverified && this.trainingDataSources.totalUnverified > 0) {
      warnings.push(`Including ${this.trainingDataSources.totalUnverified} unverified images. This may affect model quality.`);
    }

    return {
      isValid: true,
      message: `Ready to train with ${total} images across ${Object.keys(diseaseBreakdown).length} disease classes.`,
      warnings
    };
  }

  async startRetraining() {
    if (this.isRetraining) return;

    try {
      this.isRetraining = true;
      this.error = null;
      
      // Validate training data
      const validation = this.validateTrainingData();
      if (!validation.isValid) {
        throw new Error(validation.message);
      }

      // Show warnings if any
      if (validation.warnings.length > 0) {
        const proceed = confirm(
          `Training validation warnings:\n${validation.warnings.join('\n')}\n\nDo you want to proceed?`
        );
        if (!proceed) {
          this.isRetraining = false;
          return;
        }
      }

      // Initialize training progress
      this.trainingProgress = {
        currentEpoch: 0,
        totalEpochs: this.retrainingConfig.epochs,
        currentLoss: 0,
        currentAccuracy: 0,
        validationAccuracy: 0,
        estimatedTimeRemaining: 'Preparing data...',
        status: 'preparing',
        currentPhase: 'Loading verified images from database',
        processedImages: 0,
        totalImages: this.getTotalAvailableImages()
      };

      // Start the retraining process
      await this.executeRetraining();
      
    } catch (error) {
      console.error('Error starting retraining:', error);
      this.error = error instanceof Error ? error.message : 'Failed to start retraining';
      this.isRetraining = false;
      this.trainingProgress = null;
    }
  }

  private async executeRetraining() {
    const phases = [
      'Loading verified images from database',
      'Preprocessing image data',
      'Applying data augmentation',
      'Initializing model architecture',
      'Training neural network',
      'Validating model performance',
      'Saving trained model'
    ];

    // Simulate the training phases
    for (let i = 0; i < phases.length - 2; i++) {
      if (!this.isRetraining) return;
      
      await this.updateProgress('preparing', phases[i]);
      await this.sleep(2000);
    }

    // Training phase
    await this.updateProgress('training', phases[4]);
    await this.simulateTraining();

    if (!this.isRetraining) return;

    // Validation phase
    await this.updateProgress('validating', phases[5]);
    await this.sleep(3000);

    // Save model phase
    await this.updateProgress('completed', phases[6]);
    await this.sleep(2000);

    this.completeRetraining();
  }

  private async updateProgress(status: any, phase: string) {
    if (this.trainingProgress) {
      this.trainingProgress.status = status;
      this.trainingProgress.currentPhase = phase;
    }
  }

  private async simulateTraining() {
    for (let epoch = 1; epoch <= this.retrainingConfig.epochs; epoch++) {
      if (!this.isRetraining || !this.trainingProgress) break;

      // Simulate realistic training metrics
      const progress = epoch / this.retrainingConfig.epochs;
      const loss = Math.max(0.05, 2.0 - progress * 1.8 + Math.random() * 0.1);
      const accuracy = Math.min(98, 65 + progress * 30 + Math.random() * 2);
      const valAccuracy = Math.min(96, accuracy - 1 + Math.random() * 1);

      this.trainingProgress.currentEpoch = epoch;
      this.trainingProgress.currentLoss = loss;
      this.trainingProgress.currentAccuracy = accuracy;
      this.trainingProgress.validationAccuracy = valAccuracy;
      this.trainingProgress.processedImages = Math.floor(progress * this.trainingProgress.totalImages);
      
      const remainingEpochs = this.retrainingConfig.epochs - epoch;
      const estimatedMinutes = Math.ceil(remainingEpochs * 0.8);
      this.trainingProgress.estimatedTimeRemaining = 
        remainingEpochs > 0 ? `~${estimatedMinutes} minutes remaining` : 'Finalizing...';

      await this.sleep(800); // Simulate epoch time
    }
  }

  private completeRetraining() {
    if (this.trainingProgress) {
      // Update model stats with new values
      this.modelStats.accuracy = this.trainingProgress.validationAccuracy;
      this.modelStats.lastUpdated = 'Just now';
      this.modelStats.version = this.incrementVersion(this.modelStats.version);
      this.modelStats.trainingDataCount = this.getTotalAvailableImages();
      this.modelStats.status = 'active';
    }

    // Reset training state after a delay
    setTimeout(() => {
      this.isRetraining = false;
      this.trainingProgress = null;
    }, 3000);
  }

  private incrementVersion(version: string): string {
    const parts = version.replace('v', '').split('.');
    const patch = parseInt(parts[2]) + 1;
    return `v${parts[0]}.${parts[1]}.${patch}`;
  }

  stopRetraining() {
    this.isRetraining = false;
    if (this.trainingProgress) {
      this.trainingProgress.status = 'error';
      this.trainingProgress.currentPhase = 'Training stopped by user';
      this.trainingProgress.estimatedTimeRemaining = 'Training was interrupted';
    }
    
    setTimeout(() => {
      this.trainingProgress = null;
    }, 2000);
  }

  onConfigChange() {
    // Reprocess data when configuration changes
    this.processTrainingData();
  }

  async refreshData() {
    await this.loadModelData();
  }

  // Add the missing exportModel method
  async exportModel() {
    try {
      // Export current model with metadata
      const modelData = {
        version: this.modelStats.version,
        accuracy: this.modelStats.accuracy,
        trainingDataCount: this.modelStats.trainingDataCount,
        exportDate: new Date().toISOString(),
        trainingDataSources: {
          totalVerified: this.trainingDataSources.totalVerified,
          totalUnverified: this.trainingDataSources.totalUnverified,
          byDiseaseType: this.trainingDataSources.byDiseaseType,
          byImageType: this.trainingDataSources.byImageType
        },
        trainingConfig: this.retrainingConfig
      };
      
      const blob = new Blob([JSON.stringify(modelData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mango-disease-model-${this.modelStats.version}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting model:', error);
      this.error = 'Failed to export model';
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  navigateToDashboard() {
    this.router.navigate(['/admin/dashboard']);
  }
}