import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpResponse } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { tap } from 'rxjs/operators';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  
  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    const token = this.authService.getToken();
    
    // Log all API requests for debugging
    if (req.url.includes('/api/')) {
      console.log('🔗 API Request:', req.method, req.url);
    }
    
    if (token) {
      const authReq = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });
      
      return next.handle(authReq).pipe(
        tap(event => {
          if (event instanceof HttpResponse && req.url.includes('/api/')) {
            console.log('✅ API Response:', req.url, 'Status:', event.status);
            if (req.url.includes('classified-images') && event.body) {
              console.log('📸 Images response data:', event.body);
            }
          }
        })
      );
    }
    
    return next.handle(req).pipe(
      tap(event => {
        if (event instanceof HttpResponse && req.url.includes('/api/')) {
          console.log('✅ API Response (no auth):', req.url, 'Status:', event.status);
        }
      })
    );
  }
}
