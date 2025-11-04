'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, Search, Plus, Mail, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials, formatPhoneNumber } from '@/lib/utils';

export default function ContactsPage() {
  // Mock data - will be replaced with real API calls
  const contacts = [
    {
      id: '1',
      name: 'João Silva',
      phone: '+5511987654321',
      email: 'joao@example.com',
      lastInteraction: '2024-03-15',
      conversationCount: 5,
      tags: [{ id: '1', name: 'VIP', color: '#FFD700' }],
    },
    {
      id: '2',
      name: 'Maria Santos',
      phone: '+5511912345678',
      email: 'maria@example.com',
      lastInteraction: '2024-03-14',
      conversationCount: 3,
      tags: [{ id: '2', name: 'Recorrente', color: '#4CAF50' }],
    },
  ];

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contatos</h1>
          <p className="text-muted-foreground">Gerencie todos os contatos do WhatsApp</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Contato
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Contatos</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">248</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novos (30 dias)</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativos (7 dias)</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VIP</CardTitle>
            <Badge variant="warning" className="h-5">★</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar contatos..." className="pl-9" />
        </div>
        <Button variant="outline">Filtros</Button>
      </div>

      {/* Contact List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {contacts.map((contact) => (
          <Card key={contact.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-whatsapp-green text-white">
                    {getInitials(contact.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <div>
                    <h3 className="font-semibold">{contact.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>{formatPhoneNumber(contact.phone)}</span>
                    </div>
                    {contact.email && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span>{contact.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    <span>{contact.conversationCount} conversas</span>
                  </div>

                  {contact.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((tag) => (
                        <Badge key={tag.id} style={{ backgroundColor: tag.color }} className="text-xs">
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Button variant="outline" size="sm" className="w-full mt-2">
                    Ver Detalhes
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
