/**
 * System Dashboard - Visual representation of the notification pipeline
 * Shows real-time flow of events through the system like n8n workflow
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Zap, Database, Bell, Mail, MessageSquare, Smartphone,
  Server, Activity, CheckCircle, XCircle, Clock, Users,
  ArrowRight, RefreshCw, Cpu, HardDrive, Wifi, AlertTriangle
} from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'processing';
  port: number;
  lastPing?: number;
  messagesProcessed?: number;
}

interface EventLog {
  id: string;
  timestamp: string;
  service: string;
  type: string;
  message: string;
  priority?: string;
  status: 'success' | 'error' | 'pending' | 'processing';
}

interface PipelineNode {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  status: 'active' | 'idle' | 'error';
  metrics: {
    processed: number;
    pending: number;
    errors: number;
  };
}

export const SystemDashboard: React.FC = () => {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Social API', status: 'offline', port: 3003, messagesProcessed: 0 },
    { name: 'Ingestion Service', status: 'offline', port: 3000, messagesProcessed: 0 },
    { name: 'Processing Service', status: 'processing', port: 0, messagesProcessed: 0 }, // Kafka consumer only
    { name: 'Notification API', status: 'offline', port: 3002, messagesProcessed: 0 },
    { name: 'Socket Service', status: 'offline', port: 4000, messagesProcessed: 0 },
    { name: 'Email Service', status: 'processing', port: 0, messagesProcessed: 0 }, // Kafka consumer only
    { name: 'SMS Service', status: 'processing', port: 0, messagesProcessed: 0 }, // Kafka consumer only
  ]);

  const [eventLogs, setEventLogs] = useState<EventLog[]>([]);
  const [activeFlow, setActiveFlow] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalEvents: 0,
    eventsPerMinute: 0,
    avgProcessingTime: 0,
    activeConnections: 0,
  });

  // Simulated pipeline nodes
  const [pipelineNodes] = useState<PipelineNode[]>([
    {
      id: 'trigger',
      name: 'Event Trigger',
      icon: <Zap className="w-6 h-6" />,
      description: 'User actions (like, comment, follow)',
      status: 'active',
      metrics: { processed: 0, pending: 0, errors: 0 },
    },
    {
      id: 'ingestion',
      name: 'Ingestion',
      icon: <Database className="w-6 h-6" />,
      description: 'Kafka message routing',
      status: 'active',
      metrics: { processed: 0, pending: 0, errors: 0 },
    },
    {
      id: 'processing',
      name: 'Processing',
      icon: <Cpu className="w-6 h-6" />,
      description: 'Aggregation & filtering',
      status: 'active',
      metrics: { processed: 0, pending: 0, errors: 0 },
    },
    {
      id: 'delivery',
      name: 'Delivery',
      icon: <Bell className="w-6 h-6" />,
      description: 'Multi-channel dispatch',
      status: 'active',
      metrics: { processed: 0, pending: 0, errors: 0 },
    },
  ]);

  // Check service health
  const checkServiceHealth = useCallback(async () => {
    const healthChecks = [
      { name: 'Social API', port: 3003, endpoint: '/health' },
      { name: 'Ingestion Service', port: 3000, endpoint: '/health' },
      { name: 'Notification API', port: 3002, endpoint: '/health' },
      { name: 'Socket Service', port: 4000, endpoint: '/health' },
    ];

    const results = await Promise.all(
      healthChecks.map(async (check) => {
        try {
          const start = Date.now();
          const response = await fetch(`http://localhost:${check.port}${check.endpoint}`, {
            method: 'GET',
            signal: AbortSignal.timeout(2000),
          });
          const latency = Date.now() - start;
          return { name: check.name, status: response.ok ? 'online' : 'offline', lastPing: latency };
        } catch {
          return { name: check.name, status: 'offline', lastPing: undefined };
        }
      })
    );

    setServices(prevServices => 
      prevServices.map(service => {
        const result = results.find(r => r.name === service.name);
        if (result) {
          return {
            ...service,
            status: result.status as 'online' | 'offline' | 'processing',
            lastPing: result.lastPing,
          };
        }
        // Keep Kafka consumers in 'processing' state (no HTTP health endpoint)
        if (service.port === 0) {
          return { ...service, status: 'processing' };
        }
        return service;
      })
    );
  }, []);

  useEffect(() => {
    // Initial check after mount
    const timeoutId = setTimeout(() => {
      checkServiceHealth();
    }, 100);
    
    // Set up interval for periodic checks
    const interval = setInterval(checkServiceHealth, 5000);
    
    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [checkServiceHealth]);

  // Simulate event flow animation
  const simulateEventFlow = (type: string) => {
    const newEvent: EventLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      service: 'Demo',
      type,
      message: `Simulated ${type} event`,
      priority: type === 'LIKE' ? 'HIGH' : 'CRITICAL',
      status: 'processing',
    };

    setEventLogs(prev => [newEvent, ...prev.slice(0, 49)]);
    setActiveFlow('trigger');

    // Animate through pipeline
    setTimeout(() => setActiveFlow('ingestion'), 500);
    setTimeout(() => setActiveFlow('processing'), 1500);
    setTimeout(() => setActiveFlow('delivery'), 2500);
    setTimeout(() => {
      setActiveFlow(null);
      setEventLogs(prev => 
        prev.map(e => e.id === newEvent.id ? { ...e, status: 'success' } : e)
      );
      setStats(prev => ({
        ...prev,
        totalEvents: prev.totalEvents + 1,
        eventsPerMinute: prev.eventsPerMinute + 1,
      }));
    }, 3500);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'active':
      case 'success':
        return 'bg-green-500';
      case 'offline':
      case 'error':
        return 'bg-red-500';
      case 'processing':
      case 'pending':
        return 'bg-yellow-500 animate-pulse';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusBorder = (nodeId: string) => {
    if (activeFlow === nodeId) {
      return 'border-purple-500 shadow-lg shadow-purple-500/50 scale-105';
    }
    return 'border-gray-700';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            Notification System Dashboard
          </h1>
          <p className="text-gray-400 mt-1">Real-time visualization of the notification pipeline</p>
        </div>
        <button
          onClick={checkServiceHealth}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Status
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Activity className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Events</p>
              <p className="text-2xl font-bold">{stats.totalEvents}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Zap className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Events/Min</p>
              <p className="text-2xl font-bold">{stats.eventsPerMinute}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Clock className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Avg Processing</p>
              <p className="text-2xl font-bold">{stats.avgProcessingTime}ms</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-500/20 rounded-lg">
              <Users className="w-6 h-6 text-pink-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Active Connections</p>
              <p className="text-2xl font-bold">{stats.activeConnections}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Pipeline Visualization */}
      <div className="bg-gray-800 rounded-xl p-6 mb-8 border border-gray-700">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-purple-400" />
          Notification Pipeline
        </h2>
        
        {/* Pipeline Flow */}
        <div className="flex items-center justify-between relative">
          {/* Connection Lines */}
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 opacity-30" />
          
          {pipelineNodes.map((node, index) => (
            <React.Fragment key={node.id}>
              {/* Node */}
              <div
                className={`relative z-10 bg-gray-900 border-2 rounded-xl p-4 w-48 transition-all duration-300 ${getStatusBorder(node.id)}`}
              >
                <div className={`absolute -top-2 -right-2 w-4 h-4 rounded-full ${getStatusColor(activeFlow === node.id ? 'processing' : node.status)}`} />
                
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${activeFlow === node.id ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
                    {node.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{node.name}</h3>
                  </div>
                </div>
                
                <p className="text-xs text-gray-400 mb-3">{node.description}</p>
                
                <div className="grid grid-cols-3 gap-1 text-xs">
                  <div className="text-center">
                    <p className="text-green-400 font-bold">{node.metrics.processed}</p>
                    <p className="text-gray-500">Done</p>
                  </div>
                  <div className="text-center">
                    <p className="text-yellow-400 font-bold">{node.metrics.pending}</p>
                    <p className="text-gray-500">Queue</p>
                  </div>
                  <div className="text-center">
                    <p className="text-red-400 font-bold">{node.metrics.errors}</p>
                    <p className="text-gray-500">Errors</p>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              {index < pipelineNodes.length - 1 && (
                <div className={`z-10 transition-all duration-300 ${activeFlow === node.id ? 'text-purple-400 scale-125' : 'text-gray-600'}`}>
                  <ArrowRight className="w-8 h-8" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Demo Buttons */}
        <div className="mt-8 flex gap-4 justify-center">
          <button
            onClick={() => simulateEventFlow('LIKE')}
            className="px-4 py-2 bg-pink-600 hover:bg-pink-700 rounded-lg transition flex items-center gap-2"
          >
            <span>❤️</span> Simulate Like
          </button>
          <button
            onClick={() => simulateEventFlow('COMMENT')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" /> Simulate Comment
          </button>
          <button
            onClick={() => simulateEventFlow('FOLLOW')}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition flex items-center gap-2"
          >
            <Users className="w-4 h-4" /> Simulate Follow
          </button>
          <button
            onClick={() => simulateEventFlow('OTP')}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" /> Simulate OTP (Critical)
          </button>
        </div>
      </div>

      {/* Services Grid & Event Log */}
      <div className="grid grid-cols-2 gap-6">
        {/* Services Status */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-green-400" />
            Services Status
          </h2>
          
          <div className="space-y-3">
            {services.map(service => (
              <div
                key={service.name}
                className="flex items-center justify-between p-3 bg-gray-900 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(service.status)}`} />
                  <div>
                    <p className="font-medium">{service.name}</p>
                    <p className="text-xs text-gray-500">
                      {service.port === 0 ? 'Kafka Consumer' : `Port ${service.port}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {service.status === 'online' ? (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">{service.lastPing}ms</span>
                    </div>
                  ) : service.status === 'processing' ? (
                    <div className="flex items-center gap-2 text-yellow-400">
                      <Activity className="w-4 h-4 animate-pulse" />
                      <span className="text-sm">Running</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-400">
                      <XCircle className="w-4 h-4" />
                      <span className="text-sm">Offline</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Event Log */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Event Log
          </h2>
          
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {eventLogs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No events yet. Click simulate buttons above.</p>
            ) : (
              eventLogs.map(log => (
                <div
                  key={log.id}
                  className={`p-3 rounded-lg border-l-4 ${
                    log.status === 'success' ? 'bg-green-900/20 border-green-500' :
                    log.status === 'error' ? 'bg-red-900/20 border-red-500' :
                    log.status === 'processing' ? 'bg-yellow-900/20 border-yellow-500' :
                    'bg-gray-900 border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        log.priority === 'CRITICAL' ? 'bg-red-500' :
                        log.priority === 'HIGH' ? 'bg-orange-500' :
                        'bg-blue-500'
                      }`}>
                        {log.type}
                      </span>
                      <span className="text-sm text-gray-300">{log.message}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Architecture Diagram */}
      <div className="mt-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-yellow-400" />
          System Architecture
        </h2>
        
        <div className="grid grid-cols-5 gap-4 text-center">
          {/* Layer 1: Frontend */}
          <div className="col-span-5 mb-4">
            <div className="bg-purple-900/30 border border-purple-500 rounded-lg p-4 inline-block">
              <Smartphone className="w-8 h-8 mx-auto mb-2 text-purple-400" />
              <p className="font-medium">React Frontend</p>
              <p className="text-xs text-gray-400">Socket.io Client</p>
            </div>
          </div>

          {/* Layer 2: API Layer */}
          <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-3">
            <Server className="w-6 h-6 mx-auto mb-1 text-blue-400" />
            <p className="text-sm font-medium">Social API</p>
            <p className="text-xs text-gray-400">:3003</p>
          </div>
          <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-3">
            <Database className="w-6 h-6 mx-auto mb-1 text-blue-400" />
            <p className="text-sm font-medium">Ingestion</p>
            <p className="text-xs text-gray-400">:3001</p>
          </div>
          <div className="bg-orange-900/30 border border-orange-500 rounded-lg p-3">
            <Cpu className="w-6 h-6 mx-auto mb-1 text-orange-400" />
            <p className="text-sm font-medium">Processing</p>
            <p className="text-xs text-gray-400">Aggregation</p>
          </div>
          <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-3">
            <Bell className="w-6 h-6 mx-auto mb-1 text-blue-400" />
            <p className="text-sm font-medium">Notification API</p>
            <p className="text-xs text-gray-400">:3002</p>
          </div>
          <div className="bg-green-900/30 border border-green-500 rounded-lg p-3">
            <Wifi className="w-6 h-6 mx-auto mb-1 text-green-400" />
            <p className="text-sm font-medium">Socket</p>
            <p className="text-xs text-gray-400">:4000</p>
          </div>

          {/* Layer 3: Message Queue */}
          <div className="col-span-5 my-4">
            <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-4 inline-block">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="bg-red-500 text-white px-3 py-1 rounded text-sm font-bold">P0</div>
                  <p className="text-xs text-gray-400 mt-1">Critical</p>
                </div>
                <div className="text-center">
                  <div className="bg-orange-500 text-white px-3 py-1 rounded text-sm font-bold">P1</div>
                  <p className="text-xs text-gray-400 mt-1">High</p>
                </div>
                <div className="text-center">
                  <div className="bg-blue-500 text-white px-3 py-1 rounded text-sm font-bold">P2</div>
                  <p className="text-xs text-gray-400 mt-1">Low</p>
                </div>
              </div>
              <p className="font-medium mt-2">Apache Kafka</p>
              <p className="text-xs text-gray-400">Priority-based queues</p>
            </div>
          </div>

          {/* Layer 4: Delivery */}
          <div className="col-start-2 bg-pink-900/30 border border-pink-500 rounded-lg p-3">
            <Mail className="w-6 h-6 mx-auto mb-1 text-pink-400" />
            <p className="text-sm font-medium">Email</p>
            <p className="text-xs text-gray-400">SendGrid</p>
          </div>
          <div className="bg-green-900/30 border border-green-500 rounded-lg p-3">
            <Smartphone className="w-6 h-6 mx-auto mb-1 text-green-400" />
            <p className="text-sm font-medium">SMS</p>
            <p className="text-xs text-gray-400">Twilio</p>
          </div>
          <div className="bg-purple-900/30 border border-purple-500 rounded-lg p-3">
            <Bell className="w-6 h-6 mx-auto mb-1 text-purple-400" />
            <p className="text-sm font-medium">Push</p>
            <p className="text-xs text-gray-400">WebSocket</p>
          </div>

          {/* Layer 5: Storage */}
          <div className="col-span-5 mt-4 flex justify-center gap-4">
            <div className="bg-cyan-900/30 border border-cyan-500 rounded-lg p-3">
              <Database className="w-6 h-6 mx-auto mb-1 text-cyan-400" />
              <p className="text-sm font-medium">PostgreSQL</p>
              <p className="text-xs text-gray-400">Persistent Storage</p>
            </div>
            <div className="bg-red-900/30 border border-red-500 rounded-lg p-3">
              <HardDrive className="w-6 h-6 mx-auto mb-1 text-red-400" />
              <p className="text-sm font-medium">Redis</p>
              <p className="text-xs text-gray-400">Aggregation Cache</p>
            </div>
            <div className="bg-orange-900/30 border border-orange-500 rounded-lg p-3">
              <Database className="w-6 h-6 mx-auto mb-1 text-orange-400" />
              <p className="text-sm font-medium">DynamoDB</p>
              <p className="text-xs text-gray-400">Event Logging</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemDashboard;
