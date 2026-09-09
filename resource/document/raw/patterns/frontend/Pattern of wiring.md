
Create service representing endpoint call using axios. place it at folder `services` at current workdir of the component, here is the example.

```Typescript
export const SessionManagementServices = {  
  getSessions: async (): Promise<ISessionCurrentResponse[]> => {  
    const response = await axios.get<Response<ISessionCurrentResponse[]>>(ENDPOINTS.SESSIONS.CURRENT);  
    return response.data.result ?? [];  
  },  
  getTimeline: async (phone: string): Promise<ISessionTimelineResponse[]> => {  
    const response = await axios.get<Response<ISessionTimelineResponse[]>>(  
      ENDPOINTS.SESSIONS.TIMELINE.replace("{phoneNumber}", encodeURIComponent(phone))  
    );  
    return response.data.result ?? [];  
  },  
  createSession: async (data: ICreateSessionRequest): Promise<ISessionTimelineResponse> => {  
    const response = await axios.post<Response<ISessionTimelineResponse>>(ENDPOINTS.SESSIONS.CREATE, data);  
    return response.data.result;  
  },  
  endSession: async (phone: string): Promise<string> => {  
    const response = await axios.delete<Response<string>>(  
      ENDPOINTS.SESSIONS.END.replace("{phoneNumber}", encodeURIComponent(phone))  
    );  
    return response.data.result;  
  },  
};
```

Create hook which wire the service calling with state management, to incorporate that we use tanstack-query. because it provide internal state management that eliminate the needs to create new state management. place it at folder `hooks` related to wokdir of the component, here example. 

```typescript
const EMPTY_SESSIONS: ISessionCurrentResponse[] = [];  
const EMPTY_TIMELINE: ISessionTimelineResponse[] = [];  
  
export const useSessionManagement = (selectedPhone: string | null) => {  
  const sessionsQuery = useQuery<ISessionCurrentResponse[]>({  
    queryKey: ["session-management", "list"],  
    queryFn: SessionManagementServices.getSessions,  
    gcTime: 0,  
    enabled: true,  
    refetchOnWindowFocus: false,  
  });  
  
  const timelineQuery = useQuery<ISessionTimelineResponse[]>({  
    queryKey: ["session-management", "timeline", selectedPhone],  
    queryFn: () => SessionManagementServices.getTimeline(selectedPhone as string),  
    gcTime: 0,  
    enabled: Boolean(selectedPhone),  
    refetchOnWindowFocus: false,  
  });  
  
  const createSessionMutation = useMutation({  
    mutationFn: (payload: ICreateSessionRequest) => SessionManagementServices.createSession(payload),  
    onSuccess: () => {  
      CustomToast.success("Session created");  
    },  
    onError: (error: AxiosError<Response<unknown>>) => {  
      CustomToast.error(error.response?.data.message || "Failed to create session");  
    },  
  });  
  
  const endSessionMutation = useMutation({  
    mutationFn: (phone: string) => SessionManagementServices.endSession(phone),  
    onSuccess: () => {  
      CustomToast.success("Session ended");  
    },  
    onError: (error: AxiosError<Response<unknown>>) => {  
      CustomToast.error(error.response?.data.message || "Failed to end session");  
    },  
  });  
  
  return {  
    sessions: sessionsQuery.data ?? EMPTY_SESSIONS,  
    timeline: timelineQuery.data ?? EMPTY_TIMELINE,  
    isLoadingSessions: sessionsQuery.isLoading || sessionsQuery.isFetching,  
    isLoadingTimeline: timelineQuery.isLoading || timelineQuery.isFetching,  
    refetchSessions: sessionsQuery.refetch,  
    refetchTimeline: timelineQuery.refetch,  
    createSessionMutation,  
    endSessionMutation,  
  };  
};
```

Then at component, you can use it like this for Mutate operation, or use the data directly for render

```typescript
const handleCreateSession = async (payload: ICreateSessionRequest) => {  
  const phone = payload.phone.trim();  
  const message = payload.message.trim();  
  
  if (!phone || !message || !payload.step) {  
    CustomToast.error("Phone, step, and message are required");  
    return;  
  }  
  
  try {  
    const created = await createSessionMutation.mutateAsync({  
      phone,  
      step: payload.step,  
      message,  
    });  
    closeCreateDialog(false);  
    await refetchSessions();  
    if (created?.phone) {  
      setSelectedPhone(created.phone);  
    }  
  } catch (error) {  
    console.error(error);  
  }  
};
```

