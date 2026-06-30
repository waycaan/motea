import { TreeModel } from 'libs/shared/tree';
import { useCallback } from 'react';
import useFetcher from './fetcher';

interface MutateBody {
    action: 'move' | 'mutate' | 'reorder';
    data: any;
}

export default function useTreeAPI() {
    const { loading, request, abort } = useFetcher();

    const mutate = useCallback(
        async (body: MutateBody) => {
            return request<MutateBody, undefined>(
                {
                    method: 'POST',
                    url: `/api/tree`,
                },
                body
            );
        },
        [request]
    );

    const fetch = useCallback(async (status: number = 0) => {
        return request<undefined, TreeModel>({
            method: 'GET',
            url: `/api/tree?status=${status}`,
        });
    }, [request]);

    return {
        loading,
        abort,
        mutate,
        fetch,
    };
}
