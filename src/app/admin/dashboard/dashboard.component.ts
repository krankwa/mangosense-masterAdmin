import { Component } from '@angular/core';

interface DiseaseCategory {
  id: string;
  name: string;
  type: 'leaf' | 'fruit';
  description: string;
  imageCount: number;
  severity: 'low' | 'medium' | 'high';
  color: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: false
})
export class DashboardComponent {
  
  // Current date for display
  currentDate = new Date().toLocaleDateString();
  
  // Leaf diseases based on your image
  leafDiseases: DiseaseCategory[] = [
    {
      id: 'anthracnose-leaf',
      name: 'Anthracnose',
      type: 'leaf',
      description: 'Fungal disease causing dark spots on leaves',
      imageCount: 156,
      severity: 'high',
      color: 'bg-red-500'
    },
    {
      id: 'bacterial-canker',
      name: 'Bacterial Canker',
      type: 'leaf',
      description: 'Bacterial infection causing leaf blight',
      imageCount: 89,
      severity: 'medium',
      color: 'bg-orange-500'
    },
    {
      id: 'cutting-weevil',
      name: 'Cutting Weevil',
      type: 'leaf',
      description: 'Insect damage to young leaves',
      imageCount: 67,
      severity: 'low',
      color: 'bg-yellow-500'
    },
    {
      id: 'die-back',
      name: 'Die Back',
      type: 'leaf',
      description: 'Progressive dying of branches and leaves',
      imageCount: 134,
      severity: 'high',
      color: 'bg-red-600'
    },
    {
      id: 'gall-midge',
      name: 'Gall Midge',
      type: 'leaf',
      description: 'Insect galls on leaves and shoots',
      imageCount: 78,
      severity: 'medium',
      color: 'bg-orange-400'
    },
    {
      id: 'healthy-leaf',
      name: 'Healthy',
      type: 'leaf',
      description: 'Normal healthy mango leaves',
      imageCount: 245,
      severity: 'low',
      color: 'bg-green-500'
    },
    {
      id: 'powdery-mildew',
      name: 'Powdery Mildew',
      type: 'leaf',
      description: 'Fungal disease with white powdery coating',
      imageCount: 92,
      severity: 'medium',
      color: 'bg-purple-500'
    },
    {
      id: 'sooty-mould',
      name: 'Sooty Mould',
      type: 'leaf',
      description: 'Black fungal growth on leaf surfaces',
      imageCount: 103,
      severity: 'medium',
      color: 'bg-gray-700'
    }
  ];

  // Fruit diseases based on your image
  fruitDiseases: DiseaseCategory[] = [
    {
      id: 'alternaria-fruit',
      name: 'Alternaria',
      type: 'fruit',
      description: 'Fungal disease causing dark spots on fruits',
      imageCount: 87,
      severity: 'high',
      color: 'bg-red-500'
    },
    {
      id: 'anthracnose-fruit',
      name: 'Anthracnose',
      type: 'fruit',
      description: 'Fungal disease with dark sunken spots',
      imageCount: 142,
      severity: 'high',
      color: 'bg-red-600'
    },
    {
      id: 'black-mould-rot',
      name: 'Black Mould Rot',
      type: 'fruit',
      description: 'Black fungal rot affecting ripe fruits',
      imageCount: 76,
      severity: 'high',
      color: 'bg-gray-900'
    },
    {
      id: 'healthy-fruit',
      name: 'Healthy',
      type: 'fruit',
      description: 'Normal healthy mango fruits',
      imageCount: 198,
      severity: 'low',
      color: 'bg-green-500'
    },
    {
      id: 'stem-end-rot',
      name: 'Stem End Rot',
      type: 'fruit',
      description: 'Rot starting from the stem end',
      imageCount: 65,
      severity: 'medium',
      color: 'bg-orange-600'
    }
  ];

  // Statistics
  totalImages = this.leafDiseases.reduce((sum, disease) => sum + disease.imageCount, 0) + 
                this.fruitDiseases.reduce((sum, disease) => sum + disease.imageCount, 0);
  
  totalLeafImages = this.leafDiseases.reduce((sum, disease) => sum + disease.imageCount, 0);
  totalFruitImages = this.fruitDiseases.reduce((sum, disease) => sum + disease.imageCount, 0);
  
  healthyImages = this.leafDiseases.find(d => d.name === 'Healthy')!.imageCount + 
                  this.fruitDiseases.find(d => d.name === 'Healthy')!.imageCount;
  
  diseasedImages = this.totalImages - this.healthyImages;

  constructor() {}

  getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'high':
        return '🔴';
      case 'medium':
        return '🟡';
      case 'low':
        return '🟢';
      default:
        return '⚪';
    }
  }

  getSeverityText(severity: string): string {
    switch (severity) {
      case 'high':
        return 'High Risk';
      case 'medium':
        return 'Medium Risk';
      case 'low':
        return 'Low Risk';
      default:
        return 'Unknown';
    }
  }
}