import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MangoDiseaseService, UserConfirmation, ConfirmationStats } from '../../services/mango-disease.service';
import { DownloadService } from '../../services/download.service';
import { saveAs } from 'file-saver';

interface DiseaseConfirmationGroup {
  disease: string;
  correctCount: number;
  incorrectCount: number;
  totalCount: number;
  accuracy: number;
  correctConfirmations: UserConfirmation[];
  incorrectConfirmations: UserConfirmation[];
  expanded: boolean;
  downloading: boolean;
}

@Component({
  selector: 'app-user-confirmations',
  templateUrl: './user-confirmations.component.html',
  styleUrls: ['./user-confirmations.component.css'],
  standalone: false
})
export class UserConfirmationsComponent implements OnInit {
  diseaseGroups: DiseaseConfirmationGroup[] = [];
  stats: ConfirmationStats | null = null;
  loading = true;
  error: string | null = null;
  
  // Make Math available in template
  Math = Math;
  
  // Filter options
  selectedDisease: string = 'all';
  selectedCorrectness: string = 'all'; // 'all', 'correct', 'incorrect'
  searchTerm = '';
  sortBy: 'disease' | 'accuracy' | 'total' | 'date' = 'disease';
  dateRange: 'all' | 'week' | 'month' | 'year' = 'all';
  showLocationOnly = false;
  
  // Pagination
  currentPage = 1;
  pageSize = 50;
  totalCount = 0;
  
  // UI state
  exportingAll = false;
  viewMode: 'grouped' | 'list' = 'grouped';
  allConfirmations: UserConfirmation[] = [];

  constructor(
    private mangoDiseaseService: MangoDiseaseService,
    private downloadService: DownloadService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadConfirmationData();
  }

  async loadConfirmationData() {
    try {
      this.loading = true;
      this.error = null;

      // Load statistics and confirmations in parallel
      const [statsResponse, confirmationsResponse] = await Promise.all([
        this.mangoDiseaseService.getConfirmationStatistics().toPromise(),
        this.loadConfirmations()
      ]);

      if (statsResponse?.success) {
        this.stats = statsResponse.data;
      }

      console.log('Loaded confirmation data successfully');
    } catch (error) {
      console.error('Error loading confirmation data:', error);
      this.error = 'Failed to load user confirmations. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  async loadConfirmations() {
    try {
      const params: any = {
        page: this.currentPage,
        page_size: this.pageSize
      };

      // Apply filters
      if (this.selectedDisease !== 'all') {
        params.disease = this.selectedDisease;
      }
      
      if (this.selectedCorrectness !== 'all') {
        params.is_correct = this.selectedCorrectness === 'correct';
      }

      // Date range filter
      if (this.dateRange !== 'all') {
        const endDate = new Date();
        const startDate = new Date();
        
        switch (this.dateRange) {
          case 'week':
            startDate.setDate(endDate.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(endDate.getMonth() - 1);
            break;
          case 'year':
            startDate.setFullYear(endDate.getFullYear() - 1);
            break;
        }
        
        params.start_date = startDate.toISOString().split('T')[0];
        params.end_date = endDate.toISOString().split('T')[0];
      }

      const response = await this.mangoDiseaseService.getUserConfirmations(params).toPromise();

      if (response?.success) {
        this.allConfirmations = response.data.results;
        this.totalCount = response.data.count;
        
        if (this.viewMode === 'grouped') {
          this.groupConfirmationsByDisease();
        }
      }
    } catch (error) {
      console.error('Error loading confirmations:', error);
      throw error;
    }
  }

  groupConfirmationsByDisease() {
    const groupedData: { [disease: string]: UserConfirmation[] } = {};
    
    // Group confirmations by disease
    this.allConfirmations.forEach(confirmation => {
      const disease = confirmation.predicted_disease;
      if (!groupedData[disease]) {
        groupedData[disease] = [];
      }
      groupedData[disease].push(confirmation);
    });

    // Create disease groups with statistics
    this.diseaseGroups = Object.keys(groupedData).map(disease => {
      const confirmations = groupedData[disease];
      const correctConfirmations = confirmations.filter(c => c.is_correct);
      const incorrectConfirmations = confirmations.filter(c => !c.is_correct);
      
      return {
        disease,
        correctCount: correctConfirmations.length,
        incorrectCount: incorrectConfirmations.length,
        totalCount: confirmations.length,
        accuracy: confirmations.length > 0 ? (correctConfirmations.length / confirmations.length) * 100 : 0,
        correctConfirmations,
        incorrectConfirmations,
        expanded: false,
        downloading: false
      };
    });

    // Sort groups
    this.sortGroups();
  }

  sortGroups() {
    this.diseaseGroups.sort((a, b) => {
      switch (this.sortBy) {
        case 'disease':
          return a.disease.localeCompare(b.disease);
        case 'accuracy':
          return b.accuracy - a.accuracy;
        case 'total':
          return b.totalCount - a.totalCount;
        default:
          return a.disease.localeCompare(b.disease);
      }
    });
  }

  toggleGroup(group: DiseaseConfirmationGroup) {
    group.expanded = !group.expanded;
  }

  async exportConfirmations(disease?: string) {
    try {
      if (disease) {
        const group = this.diseaseGroups.find(g => g.disease === disease);
        if (group) {
          group.downloading = true;
        }
      } else {
        this.exportingAll = true;
      }

      const params: any = {};
      
      if (disease) {
        params.disease = disease;
      }
      
      // Apply current filters to export
      if (this.selectedCorrectness !== 'all') {
        params.is_correct = this.selectedCorrectness === 'correct';
      }

      if (this.dateRange !== 'all') {
        const endDate = new Date();
        const startDate = new Date();
        
        switch (this.dateRange) {
          case 'week':
            startDate.setDate(endDate.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(endDate.getMonth() - 1);
            break;
          case 'year':
            startDate.setFullYear(endDate.getFullYear() - 1);
            break;
        }
        
        params.start_date = startDate.toISOString().split('T')[0];
        params.end_date = endDate.toISOString().split('T')[0];
      }

      const blob = await this.mangoDiseaseService.exportConfirmations(params).toPromise();
      
      if (blob) {
        const filename = disease 
          ? `user-confirmations-${disease}-${new Date().toISOString().split('T')[0]}.csv`
          : `user-confirmations-all-${new Date().toISOString().split('T')[0]}.csv`;
        
        saveAs(blob, filename);
      }
      
    } catch (error) {
      console.error('Error exporting confirmations:', error);
      this.error = 'Failed to export confirmations. Please try again.';
    } finally {
      if (disease) {
        const group = this.diseaseGroups.find(g => g.disease === disease);
        if (group) {
          group.downloading = false;
        }
      } else {
        this.exportingAll = false;
      }
    }
  }

  getFilteredConfirmations(): UserConfirmation[] {
    return this.allConfirmations.filter(confirmation => {
      // Search filter
      if (this.searchTerm) {
        const searchLower = this.searchTerm.toLowerCase();
        return confirmation.predicted_disease.toLowerCase().includes(searchLower) ||
               confirmation.user_feedback?.toLowerCase().includes(searchLower) ||
               confirmation.address?.toLowerCase().includes(searchLower);
      }
      return true;
    });
  }

  onFilterChange() {
    this.currentPage = 1;
    this.loadConfirmations();
  }

  onSortChange() {
    if (this.viewMode === 'grouped') {
      this.sortGroups();
    }
  }

  onViewModeChange() {
    if (this.viewMode === 'grouped') {
      this.groupConfirmationsByDisease();
    }
  }

  onPageChange(page: number) {
    this.currentPage = page;
    this.loadConfirmations();
  }

  getAccuracyClass(accuracy: number): string {
    if (accuracy >= 90) return 'text-green-600';
    if (accuracy >= 70) return 'text-yellow-600';
    return 'text-red-600';
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  }

  getUniqueDiseasesForFilter(): string[] {
    const diseases = new Set(this.allConfirmations.map(c => c.predicted_disease));
    return Array.from(diseases).sort();
  }

  getTotalPages(): number {
    return Math.ceil(this.totalCount / this.pageSize);
  }

  getPageNumbers(): number[] {
    const totalPages = this.getTotalPages();
    const pages: number[] = [];
    const maxVisible = 5;
    
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  refresh() {
    this.loadConfirmationData();
  }

  // Image download methods
  getImageUrl(confirmation: UserConfirmation): string {
    const baseUrl = 'http://127.0.0.1:8000';
    
    if (!confirmation.image_data) {
      return '';
    }
    
    const originalUrl = confirmation.image_data.image_url;
    
    if (!originalUrl) {
      return `${baseUrl}/api/media/mango_images/${confirmation.image_data.original_filename}`;
    }
    
    if (originalUrl.startsWith('http')) {
      return originalUrl;
    }
    
    // Use custom media endpoint
    let filePath = '';
    if (originalUrl.startsWith('/media/')) {
      filePath = originalUrl.substring(7);
    } else if (originalUrl.startsWith('media/')) {
      filePath = originalUrl.substring(6);
    } else if (originalUrl.includes('mango_images/')) {
      const mangoIndex = originalUrl.indexOf('mango_images/');
      filePath = originalUrl.substring(mangoIndex);
    } else {
      filePath = originalUrl.startsWith('/') ? originalUrl.substring(1) : originalUrl;
    }
    
    return `${baseUrl}/api/media/${filePath}`;
  }

  async downloadImage(confirmation: UserConfirmation) {
    try {
      if (!confirmation.image_data) {
        alert('Image data not available for download.');
        return;
      }
      
      const imageUrl = this.getImageUrl(confirmation);
      await this.downloadService.downloadImageWithFetch(imageUrl, confirmation.image_data.original_filename);
    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Failed to download image. Please try again.');
    }
  }
}
