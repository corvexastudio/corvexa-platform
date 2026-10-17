'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  title?: string
  message?: string
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught exception]', error, errorInfo)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback
      }

      return (
        <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-6 text-center my-4">
          <div className="flex flex-col items-center gap-2 max-w-md mx-auto">
            <div className="h-9 w-9 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-red-200">
              {this.props.title || 'Component encountered an issue'}
            </h3>
            <p className="text-xs text-red-300/80 leading-relaxed">
              {this.props.message || this.state.error?.message || 'A client-side error occurred. Please try reloading or refreshing the component.'}
            </p>
            <Button
              onClick={this.handleRetry}
              variant="outline"
              size="xs"
              className="mt-2 border-red-500/30 text-red-300 hover:bg-red-500/20 hover:text-white"
            >
              <RefreshCw className="h-3 w-3 mr-1.5" />
              <span>Retry</span>
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
